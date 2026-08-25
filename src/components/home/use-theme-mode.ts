"use client";

import { useEffect, useState } from "react";

export type ThemeMode = "dark" | "light";

/**
 * Текущая тема — та, что реально нарисована на экране.
 *
 * Читается из `data-theme` на `<html>`, а не из localStorage, и это важно:
 * при значении «Авто» в хранилище ничего нет, а на экране при этом вполне
 * конкретная тема, выбранная системой. Скрипт в layout.tsx проставляет
 * атрибут до гидрации, поэтому он — единственный источник, который всегда
 * совпадает с картинкой.
 *
 * MutationObserver нужен из-за переключателя темы: он меняет атрибут, а не
 * перезагружает страницу, и фоновое видео обязано смениться вместе с ним.
 */
export function useThemeMode(): ThemeMode {
  // На сервере темы нет. «dark» как стартовое значение совпадает с
  // `data-theme="dark"` на <html> в layout.tsx — иначе первый кадр после
  // гидрации моргал бы светлым.
  const [mode, setMode] = useState<ThemeMode>("dark");

  useEffect(() => {
    const root = document.documentElement;
    const read = () => {
      const attr = root.getAttribute("data-theme");
      setMode(attr === "light" ? "light" : "dark");
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return mode;
}
