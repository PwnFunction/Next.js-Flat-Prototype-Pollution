import Head from "next/head";

export default function Home({ msg }) {
  return (
    <div>
      <Head>
        <title>Welcome</title>
      </Head>
      <p>Welcome, {msg}!</p>
    </div>
  );
}

export async function getServerSideProps(context) {
  return {
    props: { msg: "Mars" },
  };
}

export const config = { amp: true };
