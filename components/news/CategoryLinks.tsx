import { Fragment } from "react";

import { colourClass } from "@/components/site/colour";
import { CATEGORIES } from "@/lib/news/categories";
import { listHref } from "@/lib/news/parse";

import styles from "./News.module.css";

/**
 * The filter line above every news table: **All Categories** in white and the
 * six categories in their own colours, three to a line, exactly as the
 * original wrapped them.
 */
export default function CategoryLinks() {
  return (
    <div className={styles.filter}>
      <a href={listHref()} className={colourClass.white}>
        All Categories
      </a>
      {" - "}
      {CATEGORIES.map((category, index) => (
        <Fragment key={category.slug}>
          <a
            href={listHref({ category: category.slug })}
            className={colourClass[category.style]}
          >
            {category.name}
          </a>
          {/* Three to a line: the break replaces the separator, so no line
              ever starts with a dash. */}
          {index === 2 ? <br /> : index < CATEGORIES.length - 1 ? " - " : null}
        </Fragment>
      ))}
    </div>
  );
}
