import { DurableObject } from "cloudflare:workers";
import { BudgetLedger } from "./budget.mjs";
import { handleRequest } from "./gateway.mjs";

export class PlaygroundBudget extends DurableObject {
  constructor(context, env) {
    super(context, env);
    this.ledger = new BudgetLedger(context.storage);
  }

  reserve(visitor) {
    return this.ledger.reserve(visitor, Date.now());
  }

  release(lease) {
    this.ledger.release(lease);
  }
}

export default {
  fetch(request, env, context) {
    return handleRequest(request, env, context);
  },
};
