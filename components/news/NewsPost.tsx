import PageNav from "@/components/site/PageNav";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { formatLongDate, postHref, type NewsPost as Post } from "@/lib/news/parse";
import { renderMarkdown } from "@/lib/news/render";

import CategoryLinks from "./CategoryLinks";
import styles from "./News.module.css";

/**
 * One news post. The arrows walk the neighbours **within the same category**,
 * which is what the original did: the post you are reading came from a
 * category listing, and the arrows keep you in it.
 *
 * The body is Markdown rendered at build time and injected as HTML. It is not
 * sanitised, deliberately — see `lib/news/render.ts` for why, and for what has
 * to change first if posts ever stop being reviewed repo files.
 */
export default function NewsPost({
  post,
  newer,
  older,
}: {
  post: Post;
  newer: Post | null;
  older: Post | null;
}) {
  return (
    <>
      <PageNav
        prevHref={newer ? postHref(newer.slug) : undefined}
        nextHref={older ? postHref(older.slug) : undefined}
      >
        <TitleBox title={`Latest ${post.category.name} News`} />
      </PageNav>

      <CategoryLinks />

      <Panel align="left">
        <div className={styles.heading}>
          <b>
            {formatLongDate(post.date)} - {post.title}
          </b>
        </div>
        <div
          className={styles.body}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(post.body) }}
        />
      </Panel>
    </>
  );
}
