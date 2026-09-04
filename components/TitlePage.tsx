import Link from "next/link";

import styles from "./TitlePage.module.css";

export default function TitlePage() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Zanaris</h1>
        <p className={styles.subtitle}>A Lost City (2004scape) server</p>

        <Link className={styles.play} href="/serverlist">
          Play now
        </Link>

        <p className={styles.accounts}>
          Enter any username and password on your first login and the account is
          created for you.
        </p>
      </div>

      <footer className={styles.footer}>
        <a href="https://lostcity.rs/t/faq-what-is-lost-city/16">
          What is Lost City?
        </a>
      </footer>
    </main>
  );
}
