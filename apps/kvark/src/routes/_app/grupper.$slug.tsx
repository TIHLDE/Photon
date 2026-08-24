import { Link, createFileRoute } from "@tanstack/react-router";
import {
    useInfiniteQuery,
    useMutation,
    useQuery,
    useSuspenseQuery,
} from "@tanstack/react-query";
import { Button } from "@tihlde/ui/ui/button";
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@tihlde/ui/ui/empty";
import { LockIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";

import { authQueryOptions } from "#/api/auth";
import { searchUsersQuery } from "#/api/queries/roles";
import { useImageUploader } from "#/api/queries/assets";
import {
    deleteFormMutation,
    getFormByIdQuery,
    getFormSubmissionsQuery,
    updateFormMutation,
} from "#/api/queries/forms";
import {
    useIsGroupLeaderOf,
    usePermission,
    useScopedPermission,
} from "#/hooks/use-permission";
import {
    addGroupMemberMutation,
    batchUpdateUserFinesMutation,
    createFineMutation,
    createGroupFormMutation,
    createLawMutation,
    deleteFineMutation,
    deleteLawMutation,
    getGroupBySlugQuery,
    getGroupFineStatisticsQuery,
    getGroupFineUsersInfiniteQuery,
    getGroupFinesInfiniteQuery,
    getGroupFormerMembersQuery,
    getGroupFormsQuery,
    getGroupLawsQuery,
    getGroupMembersQuery,
    removeGroupMemberMutation,
    updateFineMutation,
    updateGroupMemberRoleMutation,
    updateGroupMutation,
    updateLawMutation,
} from "#/api/queries/groups";
import {
    DetailLayout,
    DetailLayoutContent,
    DetailLayoutNav,
} from "#/components/detail-layout";
import { GroupDetailHeader } from "#/components/group-detail-header";
import type { GroupEditValues } from "#/components/group-edit-dialog";
import { GroupEventsTab } from "#/components/group-events-tab";
import { GroupFinesTab } from "#/components/group-fines-tab";
import {
    GroupFormEditDialog,
    type GroupFormEditValues,
} from "#/components/group-form-edit-dialog";
import { GroupFormsTab } from "#/components/group-forms-tab";
import {
    GroupGiveFineDialog,
    type GiveFineValues,
} from "#/components/group-give-fine-dialog";
import { GroupLawsTab } from "#/components/group-laws-tab";
import {
    NewFormDialog,
    type NewFormValues,
} from "#/components/new-form-dialog";
import { GroupMembersTab } from "#/components/group-members-tab";
import { GROUP_NAV_ITEMS, type GroupNavKey } from "#/components/group-nav";
import { GroupOmTab } from "#/components/group-om-tab";
import { mapFormQuestions, toFormFieldsPayload } from "#/lib/form";
import {
    type Form,
    allowsNonMemberLeader,
    mapFine,
    mapFineUser,
    mapForm,
    mapFormerMember,
    mapGroup,
    mapLaw,
    mapMember,
    sortMembersByName,
} from "#/lib/group";
import { extractErrorMessage } from "#/lib/api-error";
import { useDebounced } from "#/lib/use-debounced";
import { errorStatus } from "#/lib/utils";

/** Module-level so the permission lookup keeps a stable identity. */
const EVENT_CREATE_PERMISSIONS = ["events:create", "events:manage"] as const;

/**
 * Et feilet søk skal ikke se ut som at ingen matcher — da leter man videre
 * etter en person som aldri ville dukket opp.
 */
const SEARCH_FAILED_MESSAGE = "Søket feilet. Prøv igjen.";

const searchSchema = z.object({
    tab: z
        .enum([
            "om",
            "medlemmer",
            "arrangementer",
            "boter",
            "lovverk",
            "sporreskjema",
        ])
        .default("om")
        .catch("om"),
    // Botfiltrene ligger i URL-en, ikke i komponenttilstand: da overlever de
    // en refresh, og en botsjef kan sende «ubetalte bøter for X» som lenke.
    botStatus: z
        .enum(["alle", "pending", "approved", "paid", "rejected"])
        .default("alle")
        .catch("alle"),
    botVisning: z.enum(["alle", "per-medlem"]).default("alle").catch("alle"),
    botBruker: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/_app/grupper/$slug")({
    component: GroupDetailPage,
    validateSearch: searchSchema,
    loader: async ({ context, params }) => {
        try {
            await context.queryClient.ensureQueryData(
                getGroupBySlugQuery(params.slug),
            );
            return { restricted: false };
        } catch (error) {
            // Private grupper svarer 403 for alle andre enn medlemmene. Det
            // avgjøres her og ikke i en errorComponent fordi statuskoden ikke
            // overlever hydreringen — bare selve feilmeldingen gjør det.
            if (errorStatus(error) === 403) return { restricted: true };
            throw error;
        }
    },
});

/** Vist i stedet for gruppesiden når gruppa er privat og du står utenfor. */
function GroupRestricted() {
    return (
        <Empty>
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <LockIcon />
                </EmptyMedia>
                <EmptyTitle>Privat gruppe</EmptyTitle>
                <EmptyDescription>
                    Denne gruppen er bare for medlemmene sine.
                </EmptyDescription>
            </EmptyHeader>
            <Button render={<Link to="/grupper" />}>Se alle grupper</Button>
        </Empty>
    );
}

function GroupDetailPage() {
    const { restricted } = Route.useLoaderData();
    // Egen komponent: den henter gruppa med useSuspenseQuery, som ville kastet
    // den samme 403-en på nytt hvis den ble montert her.
    return restricted ? <GroupRestricted /> : <GroupDetail />;
}

function GroupDetail() {
    const { slug } = Route.useParams();
    const { tab: active, botStatus, botVisning, botBruker } = Route.useSearch();
    const navigate = Route.useNavigate();
    const [fineDialogOpen, setFineDialogOpen] = useState(false);
    const [fineError, setFineError] = useState<string | null>(null);
    const [groupError, setGroupError] = useState<string | null>(null);
    const [formDialogOpen, setFormDialogOpen] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [editingForm, setEditingForm] = useState<Form | null>(null);
    const [editFormError, setEditFormError] = useState<string | null>(null);
    const [deleteFormError, setDeleteFormError] = useState<string | null>(null);

    function setActive(tab: GroupNavKey) {
        navigate({ search: (prev) => ({ ...prev, tab }) });
    }

    const { data: apiGroup } = useSuspenseQuery(getGroupBySlugQuery(slug));
    const { data: session } = useQuery(authQueryOptions);
    const { data: apiMembers } = useQuery(getGroupMembersQuery(slug, 0));
    const { data: apiFormerMembers } = useQuery(
        getGroupFormerMembersQuery(slug),
    );

    const updateMemberRole = useMutation(updateGroupMemberRoleMutation);
    const removeMember = useMutation(removeGroupMemberMutation);
    const addMember = useMutation(addGroupMemberMutation);
    const updateGroup = useMutation(updateGroupMutation);
    const createFine = useMutation(createFineMutation);
    const { uploadImage, isUploading } = useImageUploader();
    const updateFine = useMutation(updateFineMutation);
    const batchUpdateUserFines = useMutation(batchUpdateUserFinesMutation);
    const deleteFine = useMutation(deleteFineMutation);
    const createGroupForm = useMutation(createGroupFormMutation);
    const createLaw = useMutation(createLawMutation);
    const updateLaw = useMutation(updateLawMutation);
    const deleteLaw = useMutation(deleteLawMutation);
    const updateForm = useMutation(updateFormMutation);
    const deleteForm = useMutation(deleteFormMutation);

    // The scope is known here, so these mirror the API exactly: a grant for
    // this group counts, a grant for another group does not.
    const canEditGroup = useScopedPermission(
        ["groups:update", "groups:manage", "groups:delete"],
        `group:${slug}`,
    );
    const isLeader = useIsGroupLeaderOf(slug);
    const canManage = canEditGroup || isLeader;
    // Roster changes: `groups:manage` for this group, or being its leader.
    // Det samme gjelder å gi ledervervet videre — men «Legg til medlem»-veien
    // legger fortsatt bare til vanlige medlemmer, slik API-et krever.
    const hasGroupsManage = useScopedPermission(
        "groups:manage",
        `group:${slug}`,
    );
    const canManageMembers = hasGroupsManage || isLeader;
    // Skjemaene til gruppen er scopet hit, akkurat som resten av siden: et
    // grant for denne gruppen teller, et grant for en annen gruppe gjør ikke.
    // Det var en global sjekk her, og den er strengere enn API-et — «Spørre-
    // skjema» huket av på et verv gir `forms:*` scopet til `group:<slug>`, og
    // da så nestlederen skjemaet uten å komme til «Rediger» og «Se svar»,
    // enda POST /groups/:slug/form og canManageForm begge slipper hen inn.
    //
    // De to spørsmålene stilles hver for seg fordi API-et stiller dem hver for
    // seg: å opprette krever forms:create, å redigere og lese svar krever
    // forms:update. Slått sammen ville et grant på den ene vist knappene for
    // den andre, og de knappene svarer 403.
    const canCreateForms =
        useScopedPermission(
            ["forms:create", "forms:manage"],
            `group:${slug}`,
        ) || isLeader;
    const canManageForms =
        useScopedPermission(
            ["forms:update", "forms:manage"],
            `group:${slug}`,
        ) || isLeader;
    // Arrangementer er scopet på samme måte: lederskap alene gir ikke
    // events:create — det avhenger av gruppens leaderPermissions — så vi
    // spør om selve tilgangen for nettopp denne gruppen.
    const canCreateEvent = useScopedPermission(
        EVENT_CREATE_PERMISSIONS,
        `group:${slug}`,
    );
    const isRoot = usePermission("root");

    const isFinesAdmin = Boolean(
        session && apiGroup.finesAdminId === session.user?.id,
    );
    // Bøter følger medlemskap, ikke tilganger: er du med i gruppen ser du alt
    // gruppen har gitt hverandre.
    //
    // Selve avgjørelsen tas på serveren og kommer som `viewerCanUseFines`. Den
    // dekker både at gruppen faktisk bruker botsystemet og at et medlemskap i
    // en studiegruppe ikke er nok i seg selv — der er medlemslista en
    // Feide-projeksjon som aldri krymper, så alumni står oppført sammen med
    // dagens studenter. Root er ikke med i serverens svar (den gjelder én
    // gruppe, ikke tilgang på tvers), så den legges på her.
    const canViewFines = Boolean(apiGroup.viewerCanUseFines) || isRoot;
    // Den som har gått ut av gruppen tar ikke lenger del i botsystemet, men
    // bøtene i eget navn — gitt og mottatt — er fortsatt deres å slå opp.
    // Serveren snevrer botlista til dem av seg selv; her styrer flagget bare
    // hva som vises, og at ingenting kan endres.
    const canSeeOwnFines =
        !canViewFines && Boolean(apiGroup.viewerCanSeeOwnFines);
    const finesTabVisible = canViewFines || canSeeOwnFines;

    // Filtrene går til serveren, ikke gjennom en ferdiglastet liste: en gruppe
    // med noen tusen bøter skal ikke lastes ned i sin helhet for å vise 25.
    const fineFilters = useMemo(
        () => ({
            ...(botStatus === "alle" ? {} : { status: botStatus }),
            ...(botBruker ? { userId: botBruker } : {}),
        }),
        [botStatus, botBruker],
    );

    const {
        data: apiFinePages,
        hasNextPage: hasMoreFines,
        isFetchingNextPage: isLoadingMoreFines,
        fetchNextPage: fetchMoreFines,
    } = useInfiniteQuery({
        ...getGroupFinesInfiniteQuery(slug, fineFilters),
        // Egen-visningen har bare den flate lista, så den henter uansett hva
        // `botVisning` skulle stå til fra en gammel URL.
        enabled: canSeeOwnFines || (canViewFines && botVisning === "alle"),
    });

    const {
        data: apiFineUserPages,
        hasNextPage: hasMoreFineUsers,
        isFetchingNextPage: isLoadingMoreFineUsers,
        fetchNextPage: fetchMoreFineUsers,
    } = useInfiniteQuery({
        ...getGroupFineUsersInfiniteQuery(
            slug,
            botStatus === "alle" ? {} : { status: botStatus },
        ),
        enabled: canViewFines && botVisning === "per-medlem",
    });

    const { data: apiFineStatistics } = useQuery({
        ...getGroupFineStatisticsQuery(slug),
        enabled: canViewFines,
    });
    const isLoggedIn = Boolean(session);
    const { data: apiForms } = useQuery({
        ...getGroupFormsQuery(slug),
        enabled: isLoggedIn,
    });
    const { data: apiLaws } = useQuery({
        ...getGroupLawsQuery(slug),
        enabled: canViewFines,
    });

    // Spørsmålene ligger bare i detaljsvaret, og svarene avgjør om de kan
    // endres i det hele tatt. Begge hentes først når et skjema faktisk åpnes
    // for redigering.
    const { data: apiEditingForm } = useQuery({
        ...getFormByIdQuery(editingForm?.id ?? ""),
        enabled: editingForm !== null,
    });
    const { data: apiEditingSubmissions } = useQuery({
        ...getFormSubmissionsQuery(editingForm?.id ?? "", 0),
        enabled: editingForm !== null,
    });

    const members = useMemo(
        () => sortMembersByName((apiMembers ?? []).map(mapMember)),
        [apiMembers],
    );
    const leaders = useMemo(
        () => members.filter((m) => m.role === "leader"),
        [members],
    );
    const regularMembers = useMemo(
        () => members.filter((m) => m.role !== "leader"),
        [members],
    );
    const formerMembers = useMemo(
        () => (apiFormerMembers ?? []).map(mapFormerMember),
        [apiFormerMembers],
    );

    // Brukersøk for «Legg til medlem». Søket er billig nok til å ligge her,
    // men vi venter til to tegn så vi ikke slår opp hele medlemsregisteret.
    const [memberQuery, setMemberQuery] = useState("");
    // API-ets egen melding er den nyttige ("Kan ikke legge til medlemmer i en
    // avledet gruppe"), men den må hentes ut av responsen asynkront.
    const [addMemberError, setAddMemberError] = useState<string | null>(null);
    const debouncedMemberQuery = useDebounced(memberQuery);
    const {
        data: memberSearchResults,
        isFetching: isSearchingMembers,
        error: memberSearchFailure,
    } = useQuery({
        // Gruppen sendes med så lederen selv kan søke: uten den svarer API-et
        // 403 for alle uten `users:view`, og en tom liste ser ut som at
        // personen ikke finnes.
        ...searchUsersQuery(debouncedMemberQuery, slug),
        enabled: debouncedMemberQuery.length >= 2,
    });
    // Den som allerede er med skal ikke kunne legges til på nytt — API-et
    // svarer 400, og det er en dårligere forklaring enn å utelate treffet.
    const addableUsers = useMemo(
        () =>
            (memberSearchResults ?? []).filter(
                (user) => !members.some((m) => m.id === user.id),
            ),
        [memberSearchResults, members],
    );
    // Eget søk for lederoverføring i HS: presidenten er ikke medlem ennå, så
    // her filtreres ingen bort — bare den som allerede er leder.
    const canPickLeaderOutsideGroup = allowsNonMemberLeader(slug);
    const [leaderQuery, setLeaderQuery] = useState("");
    const [leaderError, setLeaderError] = useState<string | null>(null);
    const debouncedLeaderQuery = useDebounced(leaderQuery);
    const {
        data: leaderSearchResults,
        isFetching: isSearchingLeader,
        error: leaderSearchFailure,
    } = useQuery({
        ...searchUsersQuery(debouncedLeaderQuery, slug),
        enabled: canPickLeaderOutsideGroup && debouncedLeaderQuery.length >= 2,
    });
    const leaderCandidates = useMemo(
        () =>
            (leaderSearchResults ?? []).filter(
                (user) => !leaders.some((m) => m.id === user.id),
            ),
        [leaderSearchResults, leaders],
    );

    const group = useMemo(
        () => mapGroup(apiGroup, leaders[0]?.name),
        [apiGroup, leaders],
    );
    const fines = useMemo(
        () =>
            (apiFinePages?.pages ?? []).flatMap((page) =>
                page.fines.map(mapFine),
            ),
        [apiFinePages],
    );
    const fineUsers = useMemo(
        () =>
            (apiFineUserPages?.pages ?? []).flatMap((page) =>
                page.users.map(mapFineUser),
            ),
        [apiFineUserPages],
    );
    const selectedFineUserName = useMemo(
        () =>
            botBruker
                ? (fineUsers.find((u) => u.id === botBruker)?.name ??
                  members.find((m) => m.id === botBruker)?.name)
                : undefined,
        [botBruker, fineUsers, members],
    );
    const forms = useMemo(() => (apiForms ?? []).map(mapForm), [apiForms]);
    // Redigeringsdialogen venter på begge: uten svarene vet den ikke om
    // spørsmålene er låst, og da ville de rukket å bli redigerbare først.
    const editingQuestions = useMemo(
        () =>
            apiEditingForm && apiEditingSubmissions
                ? mapFormQuestions(apiEditingForm.fields)
                : null,
        [apiEditingForm, apiEditingSubmissions],
    );
    const laws = useMemo(() => (apiLaws ?? []).map(mapLaw), [apiLaws]);

    // Lovverk: the fines admin (botsjef) or the leader — same as
    // `canManageLaws` server-side.
    const canManageLaws = isLeader || isFinesAdmin || isRoot;
    // Å avgjøre en bot — godkjenne, avvise, slette — er botsjefens og lederens
    // jobb. Å gi en er noe alle i gruppen kan.
    const canManageFines = isFinesAdmin || isLeader || isRoot;
    // Å gi en bot krever nøyaktig det samme som å lese dem — serveren avviser
    // ellers POST-en med 403 etter at skjemaet er fylt ut.
    const canGiveFine = canViewFines;

    const navItems = useMemo(
        () =>
            GROUP_NAV_ITEMS.filter((item) => {
                if (item.key === "boter") return finesTabVisible;
                // Lovverket er gruppens regelverk, ikke en del av ens egen
                // botlogg: det følger medlemskapet.
                if (item.key === "lovverk") return canViewFines;
                // Spørreskjemaene ligger bak innlogging i API-et, så en
                // utlogget besøkende skal ikke se fanen i det hele tatt — den
                // ville uansett bare stått tom.
                if (item.key === "sporreskjema") return isLoggedIn;
                return true;
            }),
        [canViewFines, finesTabVisible, isLoggedIn],
    );
    // ?tab=boter kan stå i URL-en fra før rettighetene ble sjekket, så en fane
    // som ikke lenger finnes faller tilbake til «Om».
    const activeTab = navItems.some((item) => item.key === active)
        ? active
        : "om";

    async function handleSaveGroup(values: GroupEditValues) {
        setGroupError(null);
        try {
            await updateGroup.mutateAsync({
                slug,
                data: {
                    name: values.name,
                    description: values.description,
                    contactEmail: values.contactEmail,
                    ...(values.type ? { type: values.type } : {}),
                    ...(values.type ? { subtype: values.subtype } : {}),
                    finesActivated: values.finesActivated,
                    finesAdminId: values.finesAdminId,
                    finesInfo: values.finesInfo,
                },
            });
        } catch (error) {
            setGroupError(
                error instanceof Error
                    ? error.message
                    : "Ukjent feil da gruppen skulle lagres",
            );
        }
    }

    function openNewForm() {
        setFormError(null);
        setFormDialogOpen(true);
    }

    /**
     * Rekkefølgen på spørsmål og alternativer er posisjonen i lista: API-et
     * sorterer på `order`, så uten den ville skjemaet vist spørsmålene i
     * vilkårlig rekkefølge.
     */
    async function handleCreateForm(values: NewFormValues) {
        setFormError(null);
        try {
            await createGroupForm.mutateAsync({
                slug,
                data: {
                    group: slug,
                    title: values.title,
                    template: false,
                    can_submit_multiple: values.canSubmitMultiple,
                    is_open_for_submissions: values.isOpenForSubmissions,
                    opens_at: values.opensAt
                        ? values.opensAt.toISOString()
                        : null,
                    closes_at: values.closesAt
                        ? values.closesAt.toISOString()
                        : null,
                    only_for_group_members: values.onlyForGroupMembers,
                    ...(values.description
                        ? { description: values.description }
                        : {}),
                    ...(values.emailReceiverOnSubmit
                        ? {
                              email_receiver_on_submit:
                                  values.emailReceiverOnSubmit,
                          }
                        : {}),
                    fields: values.questions.map((question, order) => ({
                        title: question.title,
                        type: question.type,
                        required: question.required,
                        order,
                        options:
                            question.type === "text_answer"
                                ? []
                                : question.options.map(
                                      (option, optionOrder) => ({
                                          title: option.title,
                                          order: optionOrder,
                                      }),
                                  ),
                    })),
                },
            });

            setFormDialogOpen(false);
        } catch (error) {
            setFormError(
                error instanceof Error
                    ? error.message
                    : "Ukjent feil da spørreskjemaet skulle opprettes",
            );
        }
    }

    function handleEditForm(form: Form | null) {
        setEditFormError(null);
        setDeleteFormError(null);
        setEditingForm(form);
    }

    /**
     * Sletting følger den samme tilgangen som redigering, og tar med seg
     * svarene: API-et kaskaderer til spørsmål, alternativer og innsendinger.
     */
    async function handleDeleteForm() {
        if (!editingForm) return;
        setDeleteFormError(null);
        try {
            await deleteForm.mutateAsync({ formId: editingForm.id });
            setEditingForm(null);
        } catch (error) {
            setDeleteFormError(
                error instanceof Error
                    ? error.message
                    : "Ukjent feil da skjemaet skulle slettes",
            );
        }
    }

    /**
     * Spørsmålene sendes alltid med, id-ene inkludert: `updateFieldsAndOptions`
     * kjenner igjen spørsmål og alternativer på id og lar svarene stå. API-et
     * avviser bare endringene som ville tatt svar med seg — se
     * `findDestructiveFieldChanges`.
     */
    async function handleSaveForm(values: GroupFormEditValues) {
        if (!editingForm) return;
        setEditFormError(null);
        try {
            await updateForm.mutateAsync({
                formId: editingForm.id,
                data: {
                    title: values.title,
                    description: values.description,
                    is_open_for_submissions: values.isOpen,
                    opens_at: values.opensAt
                        ? values.opensAt.toISOString()
                        : null,
                    closes_at: values.closesAt
                        ? values.closesAt.toISOString()
                        : null,
                    can_submit_multiple: values.canSubmitMultiple,
                    only_for_group_members: values.onlyForMembers,
                    email_receiver_on_submit: values.emailReceiver || null,
                    fields: toFormFieldsPayload(values.questions),
                },
            });
            setEditingForm(null);
        } catch (error) {
            setEditFormError(
                error instanceof Error
                    ? error.message
                    : "Ukjent feil da skjemaet skulle lagres",
            );
        }
    }

    function openGiveFine() {
        setActive("boter");
        setFineError(null);
        setFineDialogOpen(true);
    }

    /**
     * Én bot per mottaker: API-et tar én bruker om gangen, mens dialogen lar
     * deg bøtelegge flere som brøt samme paragraf samtidig. Bildet lastes opp
     * én gang og deles av alle botene.
     */
    async function handleGiveFine(values: GiveFineValues) {
        setFineError(null);
        try {
            const imageUrl = values.image
                ? await uploadImage(values.image)
                : undefined;

            for (const userId of values.userIds) {
                await createFine.mutateAsync({
                    groupSlug: slug,
                    data: {
                        userId,
                        groupSlug: slug,
                        reason: values.reason,
                        amount: values.amount,
                        ...(values.lawId ? { lawId: values.lawId } : {}),
                        ...(imageUrl ? { image: imageUrl } : {}),
                    },
                });
            }

            setFineDialogOpen(false);
        } catch (error) {
            setFineError(
                error instanceof Error
                    ? error.message
                    : "Ukjent feil da boten skulle opprettes",
            );
        }
    }

    return (
        <>
            <DetailLayout
                header={
                    <GroupDetailHeader
                        group={group}
                        isAdmin={canManage}
                        canGiveFine={canGiveFine}
                        onGiveFine={openGiveFine}
                        members={members}
                        onSaveGroup={handleSaveGroup}
                        isSavingGroup={updateGroup.isPending}
                        saveGroupError={groupError}
                    />
                }
            >
                <DetailLayoutNav
                    sections={[navItems]}
                    active={activeTab}
                    onSelect={setActive}
                />

                <DetailLayoutContent>
                    {activeTab === "om" ? <GroupOmTab group={group} /> : null}
                    {activeTab === "medlemmer" ? (
                        <GroupMembersTab
                            leaders={leaders}
                            members={regularMembers}
                            formerMembers={formerMembers}
                            isAdmin={canManageMembers}
                            canPromote={canManageMembers}
                            leaderTransfer={
                                canManageMembers && canPickLeaderOutsideGroup
                                    ? {
                                          copy: {
                                              trigger: "Overfør",
                                              title: "Overfør lederverv",
                                              description:
                                                  "Den nye lederen legges til i gruppen om hen ikke er medlem. Avtroppende leder mister plassen med mindre et verv gir den.",
                                              submit: "Overfør lederverv",
                                              submitting: "Overfører …",
                                          },
                                          query: leaderQuery,
                                          onQueryChange: setLeaderQuery,
                                          results: leaderCandidates,
                                          isSearching: isSearchingLeader,
                                          isAdding: updateMemberRole.isPending,
                                          error:
                                              leaderError ??
                                              (leaderSearchFailure
                                                  ? SEARCH_FAILED_MESSAGE
                                                  : null),
                                          onAdd: async (userId) => {
                                              setLeaderError(null);
                                              try {
                                                  await updateMemberRole.mutateAsync(
                                                      {
                                                          groupSlug: slug,
                                                          userId,
                                                          data: {
                                                              role: "leader",
                                                          },
                                                      },
                                                  );
                                              } catch (error) {
                                                  setLeaderError(
                                                      await extractErrorMessage(
                                                          error,
                                                      ),
                                                  );
                                                  throw error;
                                              }
                                          },
                                      }
                                    : undefined
                            }
                            memberSearch={{
                                query: memberQuery,
                                onQueryChange: setMemberQuery,
                                results: addableUsers,
                                isSearching: isSearchingMembers,
                                isAdding: addMember.isPending,
                                error:
                                    addMemberError ??
                                    (memberSearchFailure
                                        ? SEARCH_FAILED_MESSAGE
                                        : null),
                                onAdd: async (userId) => {
                                    setAddMemberError(null);
                                    try {
                                        await addMember.mutateAsync({
                                            groupSlug: slug,
                                            data: { userId, role: "member" },
                                        });
                                    } catch (error) {
                                        setAddMemberError(
                                            await extractErrorMessage(error),
                                        );
                                        throw error;
                                    }
                                },
                            }}
                            onPromote={(member) =>
                                updateMemberRole.mutate({
                                    groupSlug: slug,
                                    userId: member.id,
                                    data: { role: "leader" },
                                })
                            }
                            onRemove={(member) =>
                                removeMember.mutate({
                                    groupSlug: slug,
                                    userId: member.id,
                                })
                            }
                        />
                    ) : null}
                    {activeTab === "arrangementer" ? (
                        <GroupEventsTab
                            slug={slug}
                            canCreateEvent={canCreateEvent}
                        />
                    ) : null}
                    {activeTab === "boter" ? (
                        <GroupFinesTab
                            fines={fines}
                            fineUsers={fineUsers}
                            statistics={apiFineStatistics}
                            memberCount={members.length}
                            finesInfo={group.finesInfo}
                            grouping={canSeeOwnFines ? "alle" : botVisning}
                            onGroupingChange={(botVisning) =>
                                navigate({
                                    search: (prev) => ({
                                        ...prev,
                                        botVisning,
                                        // Personfilteret hører til den flate
                                        // listen; det gir ingen mening i
                                        // medlemsoversikten.
                                        botBruker: undefined,
                                    }),
                                    // Filtrene ligger i URL-en, men å bytte
                                    // fane er ikke å gå til en ny side: uten
                                    // dette kastet ruteren deg til toppen midt
                                    // i botlista.
                                    resetScroll: false,
                                })
                            }
                            status={botStatus}
                            onStatusChange={(botStatus) =>
                                navigate({
                                    search: (prev) => ({ ...prev, botStatus }),
                                    resetScroll: false,
                                })
                            }
                            selectedUserId={botBruker}
                            selectedUserName={selectedFineUserName}
                            onSelectUser={(botBruker) =>
                                navigate({
                                    search: (prev) => ({
                                        ...prev,
                                        botBruker,
                                        botVisning: botBruker
                                            ? "alle"
                                            : prev.botVisning,
                                    }),
                                    resetScroll: false,
                                })
                            }
                            hasMore={
                                botVisning === "alle"
                                    ? hasMoreFines
                                    : hasMoreFineUsers
                            }
                            isLoadingMore={
                                botVisning === "alle"
                                    ? isLoadingMoreFines
                                    : isLoadingMoreFineUsers
                            }
                            onLoadMore={() => {
                                if (botVisning === "alle") {
                                    void fetchMoreFines();
                                } else {
                                    void fetchMoreFineUsers();
                                }
                            }}
                            canManage={canManageFines}
                            ownFinesOnly={canSeeOwnFines}
                            currentUserId={session?.user?.id}
                            onApprove={(fine) =>
                                updateFine.mutate({
                                    groupSlug: slug,
                                    fineId: fine.id,
                                    data: { status: "approved" },
                                })
                            }
                            onMarkPaid={(fine) =>
                                updateFine.mutate({
                                    groupSlug: slug,
                                    fineId: fine.id,
                                    data: { status: "paid" },
                                })
                            }
                            onDelete={(fine) =>
                                deleteFine.mutate({
                                    groupSlug: slug,
                                    fineId: fine.id,
                                })
                            }
                            onSaveDefense={(fine, defense) =>
                                updateFine.mutate({
                                    groupSlug: slug,
                                    fineId: fine.id,
                                    data: { defense },
                                })
                            }
                            onSettleAllForUser={(userId, status) =>
                                batchUpdateUserFines.mutate({
                                    groupSlug: slug,
                                    userId,
                                    data: { status },
                                })
                            }
                        />
                    ) : null}
                    {activeTab === "lovverk" ? (
                        <GroupLawsTab
                            laws={laws}
                            canManage={canManageLaws}
                            onSave={(values, lawId) => {
                                if (lawId) {
                                    updateLaw.mutate({
                                        groupSlug: slug,
                                        lawId,
                                        data: values,
                                    });
                                } else {
                                    createLaw.mutate({
                                        groupSlug: slug,
                                        data: values,
                                    });
                                }
                            }}
                            onDelete={(lawId) =>
                                deleteLaw.mutate({ groupSlug: slug, lawId })
                            }
                        />
                    ) : null}
                    {activeTab === "sporreskjema" ? (
                        <GroupFormsTab
                            forms={forms}
                            canCreate={canCreateForms}
                            canManage={canManageForms}
                            onNewForm={openNewForm}
                            onEditForm={handleEditForm}
                        />
                    ) : null}
                </DetailLayoutContent>
            </DetailLayout>

            <GroupGiveFineDialog
                open={fineDialogOpen}
                onOpenChange={setFineDialogOpen}
                members={members}
                laws={laws}
                onSubmit={handleGiveFine}
                isSubmitting={createFine.isPending || isUploading}
                error={fineError}
            />

            <NewFormDialog
                open={formDialogOpen}
                onOpenChange={setFormDialogOpen}
                onSubmit={handleCreateForm}
                isSubmitting={createGroupForm.isPending}
                error={formError}
            />

            <GroupFormEditDialog
                open={editingForm !== null}
                form={editingForm}
                questions={editingQuestions}
                answerCount={apiEditingSubmissions?.length ?? 0}
                onClose={() => handleEditForm(null)}
                onSubmit={handleSaveForm}
                isSubmitting={updateForm.isPending}
                error={editFormError}
                onDelete={canManageForms ? handleDeleteForm : undefined}
                isDeleting={deleteForm.isPending}
                deleteError={deleteFormError}
            />
        </>
    );
}
