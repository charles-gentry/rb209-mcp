export type JsonSchema = Record<string, any>;

export interface SwaggerParam {
  name: string;
  in: "path" | "query" | "body";
  required?: boolean;
  type?: string;
  description?: string;
  schema?: JsonSchema;
}

export interface RawOp {
  tags?: string[];
  summary?: string;
  parameters?: SwaggerParam[];
}

export interface SwaggerDoc {
  swagger: string;
  paths: Record<string, Record<string, RawOp>>;
  definitions: Record<string, JsonSchema>;
}

export interface Operation {
  method: "get" | "post";
  path: string;
  tag: string;
  summary: string;
  parameters: SwaggerParam[];
}
