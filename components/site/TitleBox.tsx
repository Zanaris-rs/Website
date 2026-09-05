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
        {links.map((link, index) => (
          <span key={link.href}>
            {link.br ? <br /> : index === 0 && !menu ? null : " - "}
            <a href={link.href} className={frame.link}>
              {link.text}
            </a>
          </span>
        ))}
      </div>
    </div>
  );
}
