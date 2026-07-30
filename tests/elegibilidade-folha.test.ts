import assert from "node:assert/strict";
import test from "node:test";
import { determinarParticipacaoFolha } from "@/lib/elegibilidade-folha";

test("pessoa jurídica não participa do motor de folha", () => {
  assert.equal(determinarParticipacaoFolha("JURIDICA"), false);
});

test("pessoa física pode participar do motor de folha", () => {
  assert.equal(determinarParticipacaoFolha("FISICA"), true);
});
