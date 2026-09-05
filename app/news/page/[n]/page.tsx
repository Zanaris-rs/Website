import type { Metadata } from "next";

import NewsList from "@/components/news/NewsList";
import Frame from "@/components/site/Frame";
import { readAllPosts } from "@/lib/news";
import { PAGE_SIZE, paginate } from "@/lib/news/parse";

/** Only the pages that exist; page 1 is `/news`, and anything else is a 404. */
export const dynamicParams = false;

export function generateStaticParams() {
  const pageCount = Math.ceil(readAllPosts().length / PAGE_SIZE);
  return Array.from({ length: Math.max(0, pageCount - 1) }, (_, i) => ({
    n: String(i + 2),
  }));
}

export async function generateMetadata({
  params,
}: PageProps<"/news/page/[n]">): Promise<Metadata> {
  const { n } = await params;
  return { title: `Latest News, page ${n}` };
}

export default async function NewsPage({ params }: PageProps<"/news/page/[n]">) {
  const { n } = await params;

  return (
    <Frame>
      <NewsList page={paginate(readAllPosts(), Number(n))} />
    </Frame>
  );
}
