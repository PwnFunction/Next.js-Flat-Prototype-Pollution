import Head from "next/head";

var unflatten = require("flat").unflatten;

export default function Vulnerable({ msg }) {
  return (
    <div>
      <Head>
        <title>Vulnerable</title>
      </Head>
      <div style={{ padding: "10px 20px" }}>
        <p>💀 {msg} page!</p>
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
