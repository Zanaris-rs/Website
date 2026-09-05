import { notFound } from "next/navigation";

import type { Metadata } from "next";

import NewsList from "@/components/news/NewsList";
import Frame from "@/components/site/Frame";
import { byCategory } from "@/lib/news";
import { CATEGORIES, categoryBySlug } from "@/lib/news/categories";
import { PAGE_SIZE, paginate } from "@/lib/news/parse";

export const dynamicParams = false;

export function generateStaticParams() {
  return CATEGORIES.flatMap((category) => {
    const pageCount = Math.ceil(byCategory(category.slug).length / PAGE_SIZE);
    return Array.from({ length: Math.max(0, pageCount - 1) }, (_, i) => ({
      cat: category.slug,
      n: String(i + 2),
    }));
  });
}

export async function generateMetadata({
  params,
}: PageProps<"/news/category/[cat]/page/[n]">): Promise<Metadata> {
  const { cat, n } = await params;
  const category = categoryBySlug(cat);
  return {
    title: category
      ? `Latest ${category.name} News, page ${n}`
      : `Latest News, page ${n}`,
  };
}

export default async function NewsCategoryPage({
  params,
}: PageProps<"/news/category/[cat]/page/[n]">) {
  const { cat, n } = await params;
  const category = categoryBySlug(cat);
  if (!category) notFound();

  return (
    <Frame>
      <NewsList
        page={paginate(byCategory(cat), Number(n))}
        category={category}
      />
    </Frame>
  );
}
