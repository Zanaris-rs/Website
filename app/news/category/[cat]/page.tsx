import { notFound } from "next/navigation";

import type { Metadata } from "next";

import NewsList from "@/components/news/NewsList";
import Frame from "@/components/site/Frame";
import { byCategory } from "@/lib/news";
import { CATEGORIES, categoryBySlug } from "@/lib/news/categories";
import { paginate } from "@/lib/news/parse";

export const dynamicParams = false;

export function generateStaticParams() {
  // All six, including the ones with nothing in them yet: a category the
  // filter line links to must be a page, not a 404.
  return CATEGORIES.map((category) => ({ cat: category.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/news/category/[cat]">): Promise<Metadata> {
  const { cat } = await params;
  const category = categoryBySlug(cat);
  return { title: category ? `Latest ${category.name} News` : "Latest News" };
}

export default async function NewsCategory({
  params,
}: PageProps<"/news/category/[cat]">) {
  const { cat } = await params;
  const category = categoryBySlug(cat);
  if (!category) notFound();

  return (
    <Frame>
      <NewsList page={paginate(byCategory(cat), 1)} category={category} />
    </Frame>
  );
}
