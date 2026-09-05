import frame from "./Frame.module.css";
import styles from "./Site.module.css";

export type TitleBoxLink = {
  href: string;
  text: string;
  /** Put this link on its own line instead of after a ` - ` separator. */
  br?: boolean;
};

/**
 * The 250px box that names the page, with the way back to the main menu under
 * it. Every page except the title screen itself starts with one.
 */
export default function TitleBox({
  title,
  menu = true,
  links = [],
}: {
  title: string;
  menu?: boolean;
  links?: TitleBoxLink[];
}) {
  return (
    <div className={styles.titleBox}>
      <div className={frame.panel}>
        <b>{title}</b>
        <br />
        {menu ? (
          <a href="/title" className={frame.link}>
            Main menu
          </a>
        ) : null}
        {links.map((link, index) => {
          // Nothing separates the first link from what is above it when there
          // is no Main menu line: not a dash, and not a <br> either, which
          // would otherwise open the box with a blank line.
          const first = index === 0 && !menu;
          return (
            <span key={link.href}>
              {first ? null : link.br ? <br /> : " - "}
              <a href={link.href} className={frame.link}>
                {link.text}
              </a>
            </span>
          );
        })}
      </div>
    </div>
  );
}
