import type {
  ClickEvent,
  IndexTreeEvent,
  PageModifiedEvent,
  QueryProviderEvent,
} from "$sb/app_event.ts";

import {
  editor,
  index,
  markdown,
  space,
  sync,
} from "$sb/silverbullet-syscall/mod.ts";

import {
  addParentPointers,
  collectNodesMatching,
  findNodeOfType,
  findParentMatching,
  nodeAtPos,
  ParseTree,
  renderToText,
  replaceNodesMatching,
  traverseTreeAsync,
} from "$sb/lib/tree.ts";
import { applyQuery, removeQueries } from "$sb/lib/query.ts";
import { niceDate } from "$sb/lib/dates.ts";
import { extractAttributes } from "$sb/lib/attribute.ts";
import { rewritePageRefs } from "$sb/lib/resolve.ts";
import { indexAttributes } from "../core/attributes.ts";
import { events } from "$sb/plugos-syscall/mod.ts";

export type Task = {
  name: string;
  done: boolean;
  deadline?: string;
  tags?: string[];
  nested?: string;
  // Not saved in DB, just added when pulled out (from key)
  pos?: number;
  page?: string;
} & Record<string, any>;

function getDeadline(deadlineNode: ParseTree): string {
  return deadlineNode.children![0].text!.replace(/📅\s*/, "");
}

export async function indexTasks({ name, tree }: IndexTreeEvent) {
  const tasks: { key: string; value: Task }[] = [];
  removeQueries(tree);
  addParentPointers(tree);
  const allAttributes: Record<string, any> = {};
  await traverseTreeAsync(tree, async (n) => {
    if (n.type !== "Task") {
      return false;
    }
    const complete = n.children![0].children![0].text! !== "[ ]";
    const task: Task = {
      name: "",
      done: complete,
    };

    rewritePageRefs(n, name);

    replaceNodesMatching(n, (tree) => {
      if (tree.type === "DeadlineDate") {
        task.deadline = getDeadline(tree);
        // Remove this node from the tree
        return null;
      }
      if (tree.type === "Hashtag") {
        if (!task.tags) {
          task.tags = [];
        }
        // Push the tag to the list, removing the initial #
        task.tags.push(tree.children![0].text!.substring(1));
        // Remove this node from the tree
        // return null;
      }
    });

    // Extract attributes and remove from tree
    const extractedAttributes = await extractAttributes(n, true);
    for (const [key, value] of Object.entries(extractedAttributes)) {
      task[key] = value;
      allAttributes[key] = value;
    }

    task.name = n.children!.slice(1).map(renderToText).join("").trim();

    const taskIndex = n.parent!.children!.indexOf(n);
    const nestedItems = n.parent!.children!.slice(taskIndex + 1);
    if (nestedItems.length > 0) {
      task.nested = nestedItems.map(renderToText).join("").trim();
    }
    tasks.push({
      key: `task:${n.from}`,
      value: task,
    });
    return true;
  });

  // console.log("Found", tasks, "task(s)");
  await index.batchSet(name, tasks);
  await indexAttributes(name, allAttributes, "task");
}

export function taskToggle(event: ClickEvent) {
  return taskToggleAtPos(event.page, event.pos);
}

export async function previewTaskToggle(eventString: string) {
  const [eventName, pos] = JSON.parse(eventString);
  if (eventName === "task") {
    return taskToggleAtPos(await editor.getCurrentPage(), +pos);
  }
}

async function toggleTaskMarker(
  pageName: string,
  node: ParseTree,
) {
  let changeTo = "[x]";
  if (node.children![0].text === "[x]" || node.children![0].text === "[X]") {
    changeTo = "[ ]";
  }
  await editor.dispatch({
    changes: {
      from: node.from,
      to: node.to,
      insert: changeTo,
    },
  });

  const parentWikiLinks = collectNodesMatching(
    node.parent!,
    (n) => n.type === "WikiLinkPage",
  );
  for (const wikiLink of parentWikiLinks) {
    const ref = wikiLink.children![0].text!;
    if (ref.includes("@")) {
      const [page, posS] = ref.split("@");
      const pos = +posS;
      if (page === pageName) {
        // In current page, just update the task marker with dispatch
        await editor.dispatch({
          changes: {
            from: pos,
            to: pos + changeTo.length,
            insert: changeTo,
          },
        });
      } else {
        let text = await space.readPage(page);

        const referenceMdTree = await markdown.parseMarkdown(text);
        // Adding +1 to immediately hit the task marker
        const taskMarkerNode = nodeAtPos(referenceMdTree, pos + 1);

        if (!taskMarkerNode || taskMarkerNode.type !== "TaskMarker") {
          console.error(
            "Reference not a task marker, out of date?",
            taskMarkerNode,
          );
          return;
        }
        taskMarkerNode.children![0].text = changeTo;
        text = renderToText(referenceMdTree);
        await space.writePage(page, text);
        sync.scheduleFileSync(`${page}.md`);
      }
    }
  }
}

export async function taskToggleAtPos(pageName: string, pos: number) {
  const text = await editor.getText();
  const mdTree = await markdown.parseMarkdown(text);
  addParentPointers(mdTree);

  const node = nodeAtPos(mdTree, pos);
  if (node && node.type === "TaskMarker") {
    await toggleTaskMarker(pageName, node);
  }
}

export async function taskToggleCommand() {
  const text = await editor.getText();
  const pos = await editor.getCursor();
  const tree = await markdown.parseMarkdown(text);
  addParentPointers(tree);

  const node = nodeAtPos(tree, pos);
  // We kwow node.type === Task (due to the task context)
  const taskMarker = findNodeOfType(node!, "TaskMarker");
  await toggleTaskMarker(await editor.getCurrentPage(), taskMarker!);
}

export async function postponeCommand() {
  const text = await editor.getText();
  const pos = await editor.getCursor();
  const tree = await markdown.parseMarkdown(text);
  addParentPointers(tree);

  const node = nodeAtPos(tree, pos)!;
  // We kwow node.type === DeadlineDate (due to the task context)
  const date = getDeadline(node);
  const option = await editor.filterBox(
    "Postpone for...",
    [
      { name: "a day", orderId: 1 },
      { name: "a week", orderId: 2 },
      { name: "following Monday", orderId: 3 },
    ],
    "Select the desired time span to delay this task",
  );
  if (!option) {
    return;
  }
  // Parse "naive" due date
  let [yyyy, mm, dd] = date.split("-").map(Number);
  // Create new naive Date object.
  // `monthIndex` parameter is zero-based, so subtract 1 from parsed month.
  const d = new Date(yyyy, mm - 1, dd);
  switch (option.name) {
    case "a day":
      d.setDate(d.getDate() + 1);
      break;
    case "a week":
      d.setDate(d.getDate() + 7);
      break;
    case "following Monday":
      d.setDate(d.getDate() + ((7 - d.getDay() + 1) % 7 || 7));
      break;
  }
  // console.log("New date", niceDate(d));
  await editor.dispatch({
    changes: {
      from: node.from,
      to: node.to,
      insert: `📅 ${niceDate(d)}`,
    },
    selection: {
      anchor: pos,
    },
  });
  // await toggleTaskMarker(taskMarker!, pos);
}

export async function queryProvider({
  query,
}: QueryProviderEvent): Promise<Task[]> {
  const allTasks: Task[] = [];

  for (const { key, page, value } of await index.queryPrefix("task:")) {
    const pos = key.split(":")[1];
    allTasks.push({
      ...value,
      page: page,
      pos: +pos,
    });
  }
  return applyQuery(query, allTasks);
}

export async function onPageModified(ev: PageModifiedEvent) {
  const TASK_STATUS_MARKER_RE = /[x ]/g;

  let doc: string | null = null;
  let tree: ParseTree | null = null;

  for (const change of ev.changes) {
    const taskStatusMarker = TASK_STATUS_MARKER_RE.exec(change.inserted)
    if (!taskStatusMarker) continue;
    
    if (!doc) {
      doc = await editor.getText()
    }
    const taskStatusMarkerPos = change.newRange.from + taskStatusMarker.index;
    if(doc.at(taskStatusMarkerPos + 1) == ']' && doc.slice(taskStatusMarkerPos - 3, taskStatusMarkerPos) == "- [") {
      if (!tree) {
        tree = await markdown.parseMarkdown(doc)
        addParentPointers(tree);
      }
      const statusNode = nodeAtPos(tree, taskStatusMarkerPos);
      if (statusNode) {
        const taskNode = findParentMatching(statusNode, (p) => p.type == "Task");
        if (taskNode) {
          const eventPayload = {
            task: 'task:' + taskNode.from,
            completed: taskStatusMarker[0] === 'x'
          }
          events.dispatchEvent("task:statusChanged", eventPayload);
        }
      }
    }
  }
}

export function onTaskStatusChanged(ev: { task: string, completed: boolean }) {
  console.log(ev);
}