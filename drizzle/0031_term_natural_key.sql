DROP INDEX "uq_termo_empresa_numero";
CREATE UNIQUE INDEX "uq_termo_empresa_numero_inicio"
  ON "termo" USING btree ("empresa_id", "numero", "inicio");
