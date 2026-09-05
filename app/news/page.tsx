import type { Metadata } from "next";

import NewsList from "@/components/news/NewsList";
import Frame from "@/components/site/Frame";
import { readAllPosts } from "@/lib/news";
import { paginate } from "@/lib/news/parse";

export const metadata: Metadata = { title: "Latest News" };

/**
 * Every news URL is a path, and every path is prerendered: `/news/page/2`
 * rather than `/news?page=2`, `/news/category/website` rather than `?cat=2`.
 * That is why nothing here reads `content/` on a request.
 */
export default function News() {
  return (
    <Frame>
      <NewsList page={paginate(readAllPosts(), 1)} />
    </Frame>
  );
}
