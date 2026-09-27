import { main } from "./main.ts";

process.exitCode = await main(process.argv.slice(2));
