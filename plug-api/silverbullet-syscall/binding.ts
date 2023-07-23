export function setBinding(
  object: string,
  from: number,
  to: number,
): Promise<void> {
  return syscall("binding.set", object, from, to);
}
