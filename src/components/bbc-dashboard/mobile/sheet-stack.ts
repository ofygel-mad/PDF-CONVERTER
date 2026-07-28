"use client";

/**
 * Кто наверху — тот и закрывается.
 *
 * Шиты открываются поверх шитов, а Esc и клик по подложке обязаны бить только по
 * верхнему. Без общего стека каждый шит слушал бы Escape сам и закрывались бы
 * разом все.
 */
const stack: string[] = [];

export function pushSheet(id: string) {
  stack.push(id);
}

export function popSheet(id: string) {
  const index = stack.lastIndexOf(id);
  if (index !== -1) stack.splice(index, 1);
}

export function isTopSheet(id: string): boolean {
  return stack.length > 0 && stack[stack.length - 1] === id;
}
