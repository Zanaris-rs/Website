import Link from "next/link";

import WorldTable from "@/components/WorldTable";

import styles from "./page.module.css";

export default function ServerList() {
  return (
    <main className={styles.page}>
      <h1 className={styles.heading}>Choose a world</h1>
      <WorldTable />
      <p className={styles.back}>
        <Link href="/title">Back to the title screen</Link>
      </p>
    </main>
  );
}
