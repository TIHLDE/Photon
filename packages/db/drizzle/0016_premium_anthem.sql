CREATE TABLE "toddel_issue" (
	"edition" integer PRIMARY KEY NOT NULL,
	"title" varchar(200) NOT NULL,
	"image_url" text,
	"pdf_url" text NOT NULL,
	"published_at" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
