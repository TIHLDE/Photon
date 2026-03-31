import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link, stripSearchParams, useNavigate } from "@tanstack/react-router";
import { authClient } from "~/api/auth";
import Page from "~/components/navigation/Page";
import { Button, buttonVariants } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { analyticsEvent } from "~/hooks/Utils";
import URLS from "~/URLS";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const loginSearchSchema = z.object({
  redirectTo: z.string().optional().default("/"),
});
export const Route = createFileRoute("/_MainLayout/logg-inn")({
  validateSearch: loginSearchSchema,
  search: {
    middlewares: [stripSearchParams({ redirectTo: "/" })],
  },
  component: LoginPage,
});

const formSchema = z.object({
  username: z.string().min(1, {
    error: "Brukernavn er påkrevd",
  }),
  password: z.string().min(1, {
    error: "Passorde er påkrevd",
  }),
  rememberMe: z.boolean(),
});

function LoginPage() {
  const { redirectTo } = Route.useSearch();
  const navigate = useNavigate();
  const { data } = authClient.useSession();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      password: "",
      rememberMe: false,
    },
  });

  async function loginUsername({ username, password, rememberMe }: z.infer<typeof formSchema>) {
    const redirectUrl = redirectTo || "/";

    const result = await authClient.signIn.username({
      username,
      password,
      rememberMe,
    });

    if (result.error != null) {
      return toast.error("Kunne ikke logge inn: " + result.error.message);
    }

    analyticsEvent("login", "auth", "Logged inn");
    navigate({ to: redirectUrl });
  }

  async function loginFeide() {
    const redirectUrl = redirectTo || "/";

    const result = await authClient.signIn.oauth2({
      providerId: "feide",
      requestSignUp: true,
      callbackURL: new URL(redirectUrl, window.location.origin).toString(),
    });

    if (result.error != null) {
      return toast.error("Kunne ikke logge inn med Feide: " + result.error.message);
    }
    analyticsEvent("login", "auth-feide", "Logging in with Feide");
  }

  return (
    <Page>
      <Card className="max-w-lg w-full mx-auto">
        <CardHeader>
          <CardTitle>Logg inn</CardTitle>
          <CardDescription>Logg inn med ditt TIHLDE brukernavn og passord</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form className="space-y-6" onSubmit={form.handleSubmit(loginUsername)}>
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Brukernavn <span className="text-red-300">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Skriv her..." autoComplete="username" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Passord <span className="text-red-300">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Skriv her..." type="password" autoComplete="current-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rememberMe"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="font-normal cursor-pointer">Husk meg</FormLabel>
                  </FormItem>
                )}
              />

              <Button className="w-full" disabled={form.formState.isSubmitting} size="lg" type="submit">
                {form.formState.isSubmitting ? "Logger inn..." : "Logg inn"}
              </Button>
              <Button className="w-full" disabled={form.formState.isSubmitting} size="lg" type="button" onClick={loginFeide}>
                Logg inn med Feide
              </Button>
            </form>
          </Form>

          <div className="flex items-center justify-center space-x-12 mt-6">
            <Link className={buttonVariants({ variant: "link" })} to={URLS.forgotPassword}>
              Glemt passord?
            </Link>

            <Link className={buttonVariants({ variant: "link" })} to={URLS.signup}>
              Opprett bruker
            </Link>
          </div>
          <pre>{JSON.stringify(data, null, 4)}</pre>
        </CardContent>
      </Card>
    </Page>
  );
}
