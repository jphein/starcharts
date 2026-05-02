import { init } from "@instantdb/react";
import { schema } from "./schema";

export const APP_ID = "e526d9cf-e783-4a99-b3b3-a69730ecdd7e";

export const db = init({
  appId: APP_ID,
  schema,
});
