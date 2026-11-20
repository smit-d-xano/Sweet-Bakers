import { workspace, workspaceConfig } from "@xano/sdk";
import { allTables } from "./tables.js";
import { allFunctions } from "./functions.js";
import { storeApi, storeQueries } from "./api/store.js";
import { adminApi, adminQueries } from "./api/admin.js";

export default workspace("new-app-2")
  .registerWorkspace(
    workspaceConfig({
      env: { STRIPE_SECRET_KEY: "", STRIPE_WEBHOOK_SECRET: "", RESEND_API_KEY: "", APP_URL: "" },
    }),
  )
  .registerTables(allTables)
  .registerFunctions(allFunctions)
  .registerApiGroups([storeApi, adminApi])
  .registerQueries([...storeQueries, ...adminQueries]);
