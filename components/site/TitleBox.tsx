import frame from "./Frame.module.css";
import styles from "./Site.module.css";

export type TitleBoxLink = {
  href: string;
  text: string;
  /** Put this link on its own line instead of after a ` - ` separator. */
  br?: boolean;
  /**
   * The page this box is on: rendered as text rather than as a link to itself.
   *
   * For a box whose links are a section nav, where one of them is always the
   * page you are already reading — /economy does this with its four pages.
   */
  current?: boolean;
};

/**
 * The 250px box that names the page, with the way back to the main menu under
 * it. Every page except the title screen itself starts with one.
 */
export default function TitleBox({
  title,
  menu = true,
  links = [],
  width,
}: {
  title: string;
  menu?: boolean;
  links?: TitleBoxLink[];
  /**
   * Wider than `--title-max`, for a box carrying a section nav rather than one
   * or two links out. `Panel` takes the same escape hatch for the same reason.
   */
  width?: number | string;
}) {
  return (
    <div
      className={styles.titleBox}
      style={width === undefined ? undefined : { width }}
    >
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
              {link.current ? (
                <span className={styles.titleBoxCurrent} aria-current="page">
                  {link.text}
                </span>
              ) : (
                <a href={link.href} className={frame.link}>
                  {link.text}
                </a>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
