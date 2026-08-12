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
    getFormByIdQuery,
    getFormSubmissionsQuery,
    updateFormMutation,
} from "#/api/queries/forms";
import {
    useIsGroupLeaderOf,
    useIsGroupMemberOf,
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

    // The scope is known here, so these mirror the API exactly: a grant for
    // this group counts, a grant for another group does not.
    const canEditGroup = useScopedPermission(
        ["groups:update", "groups:manage", "groups:delete"],
        `group:${slug}`,
    );
    const isLeader = useIsGroupLeaderOf(slug);
    const canManage = canEditGroup || isLeader;
    // Roster changes: `groups:manage` for this group, or being its leader.
    // Adding someone AS leader still needs `groups:manage` — the dialog only
    // adds plain members, and the API refuses the rest.
    const hasGroupsManage = useScopedPermission(
        "groups:manage",
        `group:${slug}`,
    );
    const canManageMembers = hasGroupsManage || isLeader;
    // Creating forms: a global forms:create/manage grant, or leadership of
    // THIS group — exactly what POST /groups/:slug/form checks. The previous
    // "in any scope" check let anyone holding forms:create for their own
    // group manage forms on every other group's page.
    const hasFormsPermission = usePermission(["forms:create", "forms:manage"]);
    const canManageForms = hasFormsPermission || isLeader;
    const isMember = useIsGroupMemberOf(slug);
    const isRoot = usePermission("root");

    const isFinesAdmin = Boolean(
        session && apiGroup.finesAdminId === session.user?.id,
    );
    // Bøter følger medlemskap, ikke tilganger: er du med i gruppen ser du alt
    // gruppen har gitt hverandre. Botsjefen og root ser det også — samme regel
    // som GET-endepunktene.
    //
    // `finesActivated` avgjør først: en gruppe som ikke bruker botsystemet har
    // verken lovverk eller bøter å vise, og fanene sto likevel der for alle
    // medlemmene.
    const canViewFines =
        apiGroup.finesActivated && (isMember || isFinesAdmin || isRoot);

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
        enabled: canViewFines && botVisning === "alle",
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
    const { data: apiForms } = useQuery({
        ...getGroupFormsQuery(slug),
        enabled: Boolean(session),
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
    const { data: memberSearchResults, isFetching: isSearchingMembers } =
        useQuery({
            ...searchUsersQuery(debouncedMemberQuery),
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
    const canGiveFine = Boolean(
        apiGroup.finesActivated && (isMember || isFinesAdmin || isRoot),
    );

    const navItems = useMemo(
        () =>
            GROUP_NAV_ITEMS.filter((item) =>
                item.key === "boter" || item.key === "lovverk"
                    ? canViewFines
                    : true,
            ),
        [canViewFines],
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
        setEditingForm(form);
    }

    /**
     * Spørsmålene sendes bare når dialogen faktisk lot noen endre dem:
     * `updateFieldsAndOptions` sletter spørsmål som mangler i lista, og med
     * dem svarene som hører til.
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
                    can_submit_multiple: values.canSubmitMultiple,
                    only_for_group_members: values.onlyForMembers,
                    email_receiver_on_submit: values.emailReceiver || null,
                    ...(values.questions
                        ? { fields: toFormFieldsPayload(values.questions) }
                        : {}),
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
                            canPromote={hasGroupsManage}
                            memberSearch={{
                                query: memberQuery,
                                onQueryChange: setMemberQuery,
                                results: addableUsers,
                                isSearching: isSearchingMembers,
                                isAdding: addMember.isPending,
                                error: addMemberError,
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
                        <GroupEventsTab slug={slug} />
                    ) : null}
                    {activeTab === "boter" ? (
                        <GroupFinesTab
                            fines={fines}
                            fineUsers={fineUsers}
                            statistics={apiFineStatistics}
                            memberCount={members.length}
                            finesInfo={group.finesInfo}
                            grouping={botVisning}
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
                            isAdmin={canManageForms}
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
            />
        </>
    );
}
