import Head from "next/head";
import Link from "next/link";

var unflatten = require("flat").unflatten;

export default function Vulnerable({ msg }) {
  return (
    <div>
      <Head>
        <title>Vulnerable</title>
      </Head>
      <div style={{ padding: "5px 20px" }}>
        <p>💀 {msg} page!</p>
        <li>
          <Link href="/">
            <a>Back</a>
          </Link>
        </li>
      </div>
    </div>
  );
}

export async function getServerSideProps(context) {
  const out = unflatten({ ...context.query });

  return {
    props: { msg: "Vulnerable" },
  };
}
