import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { fetchCustomPage, type CustomPage } from "@/lib/site-content.functions";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/sida/$slug")({
  loader: async ({ params }) => {
    const res = await fetchCustomPage({ data: { slug: params.slug } });
    if (!res.page) throw notFound();
    return { page: res.page };
  },
  head: ({ loaderData, params }) => {
    const page = (loaderData as { page?: CustomPage } | undefined)?.page;
    const slug = (params as { slug?: string } | undefined)?.slug ?? "";
    return pageHead({
      path: `/sida/${slug}`,
      title: page ? `${page.title} — PeptivaLab Group` : "PeptivaLab Group",
      description:
        page?.meta_description ||
        "PeptivaLab Group — högrena forskningspeptider för laboratoriebruk.",
      type: "article",
    });
  },
  notFoundComponent: () => (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-ocean-deep">Sidan finns inte</h1>
        <p className="mt-2 text-muted-foreground">Den här sidan har tagits bort eller flyttats.</p>
        <Link to="/" className="mt-6 inline-block rounded-full bg-ocean-deep px-6 py-2 text-sm font-semibold uppercase tracking-wider text-primary-foreground">
          Till startsidan
        </Link>
      </div>
    </div>
  ),
  component: CustomPageView,
});

function CustomPageView() {
  const { page } = Route.useLoaderData();
  return (
    <>
      <section className="bg-ocean py-16 text-primary-foreground md:py-20">
        <div className="mx-auto max-w-4xl px-4 md:px-8">
          <h1 className="text-4xl font-bold md:text-5xl">{page.title}</h1>
          {page.meta_description && (
            <p className="mt-3 text-primary-foreground/80">{page.meta_description}</p>
          )}
        </div>
      </section>
      <section className="bg-background py-16 md:py-20">
        <div className="mx-auto max-w-3xl px-4 md:px-8">
          <article className="prose prose-neutral max-w-none whitespace-pre-wrap text-foreground">
            {page.body}
          </article>
        </div>
      </section>
    </>
  );
}
