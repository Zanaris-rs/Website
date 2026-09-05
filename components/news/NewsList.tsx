import { colourClass } from "@/components/site/colour";
import frame from "@/components/site/Frame.module.css";
import PageNav from "@/components/site/PageNav";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import type { NewsCategory } from "@/lib/news/categories";
import { formatShortDate, listHref, postHref, type Page } from "@/lib/news/parse";

import CategoryLinks from "./CategoryLinks";
import styles from "./News.module.css";

/**
 * A page of news: the prev/next stone arrows round the title box, the
 * coloured category filter, and the Category | News Item | Date table.
 *
 * "Prev" means *newer* here, because the list is newest-first — the arrows
 * walk the list, not the calendar.
 */
export default function NewsList({
  page,
  category,
}: {
  page: Page;
  category?: NewsCategory;
}) {
  const title = category ? `Latest ${category.name} News` : "Latest News";
  const href = (n: number) => listHref({ category: category?.slug, page: n });

  return (
    <>
      <PageNav
        prevHref={page.prevPage ? href(page.prevPage) : undefined}
        nextHref={page.nextPage ? href(page.nextPage) : undefined}
      >
        <TitleBox title={title} />
      </PageNav>

      <CategoryLinks />

      <Panel>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.category}>Category</th>
              <th>News Item</th>
              <th className={styles.date}>Date</th>
            </tr>
          </thead>
          <tbody>
            {page.items.map((post) => (
              <tr key={post.slug}>
                <td className={colourClass[post.category.style]}>
                  {post.category.name}
                </td>
                <td>
                  <a href={postHref(post.slug)} className={frame.link}>
                    {post.title}
                  </a>
                </td>
                <td className={styles.date}>{formatShortDate(post.date)}</td>
              </tr>
            ))}
            {page.items.length === 0 ? (
              <tr>
                <td colSpan={3} className={styles.empty}>
                  There is no news here yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Panel>
    </>
  );
}
