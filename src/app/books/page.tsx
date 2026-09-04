import type { Metadata } from "next";

import { BooksClient } from "@/components/books/books-client";

export const metadata: Metadata = {
  title: "Книги — внутренние книги компании",
};

export default function BooksPage() {
  return <BooksClient />;
}
