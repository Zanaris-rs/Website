import { notFound } from "next/navigation";

import type { Metadata } from "next";

import NewsPostView from "@/components/news/NewsPost";
import Frame from "@/components/site/Frame";
import { byCategory, bySlug, readAllPosts } from "@/lib/news";
import { neighbours } from "@/lib/news/parse";

export const dynamicParams = false;

export function generateStaticParams() {
  return readAllPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/news/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const post = bySlug(slug);
  return post
    ? { title: post.title, description: `${post.category.name} — Zanaris news.` }
    : { title: "News" };
}

export default async function NewsPostPage({
  params,
}: PageProps<"/news/[slug]">) {
  const { slug } = await params;
  const post = bySlug(slug);
  if (!post) notFound();

  // The arrows stay inside the category the reader is in.
  const { newer, older } = neighbours(byCategory(post.category.slug), slug);

  return (
    <Frame>
      <NewsPostView post={post} newer={newer} older={older} />
    </Frame>
  );
}
