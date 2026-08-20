import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Badge } from "@tihlde/ui/ui/badge";
import { Button } from "@tihlde/ui/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@tihlde/ui/ui/card";
import { Checkbox } from "@tihlde/ui/ui/checkbox";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@tihlde/ui/ui/collapsible";
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@tihlde/ui/ui/dialog";
import {
    Field,
    FieldDescription,
    FieldGroup,
    FieldLabel,
} from "@tihlde/ui/ui/field";
import { Input } from "@tihlde/ui/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@tihlde/ui/ui/select";
import { RichEditor } from "@tihlde/ui/complex/markdown";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@tihlde/ui/ui/table";
import type {
    GroupMember,
    GroupSignatureList,
    GroupSignatureMember,
    GroupWithMemberCount,
} from "@tihlde/sdk";
import { Tabs, TabsList, TabsTrigger } from "@tihlde/ui/ui/tabs";
import { Skeleton } from "@tihlde/ui/ui/skeleton";
import {
    CheckCircle2,
    PlusIcon,
    Trash2,
    UsersIcon,
    XCircle,
} from "lucide-react";
import { useState } from "react";

import { Stagger } from "@tihlde/ui/ui/motion";

import { requireAdminSection } from "#/lib/admin-access";
import { useImageUploader } from "#/api/queries/assets";
import {
    createGroupMutation,
    getGroupMembersQuery,
    getGroupsQuery,
    removeGroupMemberMutation,
    updateGroupMutation,
} from "#/api/queries/groups";
import {
    getGroupSignaturesQuery,
    revokeSignatureMutation,
} from "#/api/queries/contracts";
import { AdminEmptyState } from "#/components/admin-empty-state";
import { AdminImageField } from "#/components/admin-image-field";
import { richRegistry } from "#/components/markdown/directives/presets";
import { AdminPageHeader } from "#/components/admin-page-header";
import {
    useAnyScopePermission,
    useCanActForGroup,
    useIsGroupLeaderOf,
    useLedGroupSlugs,
    usePermission,
    useScopedPermission,
} from "#/hooks/use-permission";
import {
    canEditGroupType,
    GROUP_SUBTYPE_OPTIONS,
    GROUP_TYPE_OPTIONS,
    groupSubtypeValue,
    groupTypeLabel,
    supportsGroupSubtype,
} from "#/lib/group";
import { OSLO_DATE_OPTIONS } from "#/lib/date";

export const Route = createFileRoute("/admin/grupper")({
    component: GrupperAdminPage,
    beforeLoad: async ({ location }) => {
        await requireAdminSection(location.href, "grupper", {
            allowGroupLeader: true,
        });
    },
    loader: async ({ context }) => {
        await context.queryClient.ensureQueryData(getGroupsQuery(0));
        return { breadcrumbs: "Grupper" };
    },
});

// Kontraktsignering gjelder kun verv (undergrupper, komiteer, styrer,
// interessegrupper, idrettslag). Automatisk genererte grupper (klassetrinn,
// studier, TIHLDE) administreres ikke her; private bøtelag har en egen fane
// bare teknologiministeren ser ({@link PRIVATE_TAB}).
//
// Fanene dekker de samme typene som kan velges i redigeringen
// (EDITABLE_GROUP_TYPES), slik at en gruppe som bytter type fortsatt står i
// en fane etterpå.
const GROUP_TYPE_TABS = [
    { type: "SUBGROUP", label: "Undergrupper" },
    { type: "COMMITTEE", label: "Komiteer" },
    { type: "BOARD", label: "Styrer" },
    { type: "INTERESTGROUP", label: "Interessegrupper" },
    { type: "SPORTSTEAM", label: "Idrettslag" },
] as const;

type EditableTabType = (typeof GROUP_TYPE_TABS)[number]["type"];

/**
 * Private bøtelag lages av medlemmene selv og hører ikke hjemme sammen med
 * vervene, men teknologiministeren trenger likevel et sted å se og rydde i
 * dem. Fanen vises derfor bare for `root`.
 */
const PRIVATE_TAB = { type: "PRIVATE", label: "Private" } as const;

type TabType = EditableTabType | (typeof PRIVATE_TAB)["type"];

/**
 * Everything this page lets you do to a single group. Holding one of these for
 * a group — or leading it — is what makes the group worth listing here at all.
 */
const GROUP_ADMIN_PERMISSIONS = [
    "groups:update",
    "groups:manage",
    "contracts:view",
    "contracts:manage",
] as const;

function GrupperAdminPage() {
    const { data: allGroups } = useSuspenseQuery(getGroupsQuery(0));
    const [tab, setTab] = useState<TabType>("SUBGROUP");
    // Kun teknologiministeren (root) ser de private bøtelagene.
    const canSeePrivate = usePermission("root");
    const tabs = canSeePrivate
        ? [...GROUP_TYPE_TABS, PRIVATE_TAB]
        : GROUP_TYPE_TABS;
    const [expandedSlug, setExpandedSlug] = useState<string | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const canCreate = useAnyScopePermission(["groups:create", "groups:manage"]);

    // The listing endpoint is public, so the narrowing happens here: someone
    // holding `groups:update@group:nok` administers NoK, not Index. A global
    // grant satisfies every group, so admins still see all of them.
    const canActForGroup = useCanActForGroup(GROUP_ADMIN_PERMISSIONS);
    const ledSlugs = useLedGroupSlugs();
    const groups = allGroups.filter(
        (group) =>
            group.type === tab &&
            (canActForGroup(group.slug) || ledSlugs.has(group.slug)),
    );

    return (
        <Stagger
            render={
                <div className="container mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8" />
            }
        >
            <AdminPageHeader
                title="Grupper"
                description="Opprett grupper, administrer medlemmer og kontraktsignering."
                action={
                    canCreate ? (
                        <Button onClick={() => setCreateOpen(true)}>
                            <PlusIcon className="size-4" />
                            Ny gruppe
                        </Button>
                    ) : null
                }
            />
            <CreateGroupDialog
                open={createOpen}
                // Private bøtelag opprettes ikke herfra — skjemaet tilbyr bare
                // vervtypene, så fanen faller tilbake til undergruppe.
                defaultType={tab === "PRIVATE" ? "SUBGROUP" : tab}
                onOpenChange={setCreateOpen}
            />
            <Tabs value={tab} onValueChange={(v) => setTab(v as TabType)}>
                <TabsList>
                    {tabs.map(({ type, label }) => (
                        <TabsTrigger key={type} value={type}>
                            {label}
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>
            {groups.length === 0 ? (
                <AdminEmptyState
                    icon={UsersIcon}
                    title="Ingen grupper"
                    description="Du administrerer ingen grupper av denne typen."
                />
            ) : (
                <div className="flex flex-col gap-4">
                    {groups.map((group) => (
                        <GroupCard
                            key={group.slug}
                            group={group}
                            expanded={expandedSlug === group.slug}
                            onToggle={() =>
                                setExpandedSlug(
                                    expandedSlug === group.slug
                                        ? null
                                        : group.slug,
                                )
                            }
                        />
                    ))}
                </div>
            )}
        </Stagger>
    );
}

/**
 * Slugs are part of a group's public URL and are referenced by eight foreign
 * keys, so they are set once at creation and never edited afterwards.
 */
function slugify(value: string) {
    return value
        .toLowerCase()
        .trim()
        .replace(/[æ]/g, "ae")
        .replace(/[ø]/g, "o")
        .replace(/[å]/g, "a")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function CreateGroupDialog({
    open,
    defaultType,
    onOpenChange,
}: {
    open: boolean;
    defaultType: EditableTabType;
    onOpenChange: (open: boolean) => void;
}) {
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [slugTouched, setSlugTouched] = useState(false);
    const [description, setDescription] = useState("");
    const [type, setType] = useState<EditableTabType>(defaultType);
    const [subtype, setSubtype] = useState<string>("GRUPPE");
    const [error, setError] = useState<string | null>(null);

    const createGroup = useMutation(createGroupMutation);

    function handleNameChange(value: string) {
        setName(value);
        if (!slugTouched) setSlug(slugify(value));
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        try {
            await createGroup.mutateAsync({
                data: {
                    name,
                    slug,
                    type,
                    ...(supportsGroupSubtype(type) ? { subtype } : {}),
                    description: description || undefined,
                    finesInfo: "",
                    finesActivated: false,
                },
            });
            onOpenChange(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl">
                <form
                    onSubmit={handleSubmit}
                    className="flex min-h-0 flex-auto flex-col gap-4"
                >
                    <DialogHeader>
                        <DialogTitle>Ny gruppe</DialogTitle>
                    </DialogHeader>
                    <DialogBody>
                        <FieldGroup>
                            <Field>
                                <FieldLabel htmlFor="group-name">
                                    Navn
                                </FieldLabel>
                                <Input
                                    id="group-name"
                                    type="text"
                                    required
                                    value={name}
                                    onChange={(e) =>
                                        handleNameChange(e.target.value)
                                    }
                                />
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="group-slug">
                                    Slug (URL)
                                </FieldLabel>
                                <Input
                                    id="group-slug"
                                    type="text"
                                    required
                                    value={slug}
                                    onChange={(e) => {
                                        setSlugTouched(true);
                                        setSlug(e.target.value);
                                    }}
                                />
                                <FieldDescription>
                                    Kan ikke endres senere.
                                </FieldDescription>
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="group-type">
                                    Type
                                </FieldLabel>
                                <Select
                                    items={GROUP_TYPE_TABS.map(
                                        ({ type: value, label }) => ({
                                            value,
                                            label,
                                        }),
                                    )}
                                    value={type}
                                    onValueChange={(value) =>
                                        setType(
                                            (value as EditableTabType) ??
                                                defaultType,
                                        )
                                    }
                                >
                                    <SelectTrigger id="group-type">
                                        <SelectValue placeholder="Velg type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {GROUP_TYPE_TABS.map(
                                            ({ type: value, label }) => (
                                                <SelectItem
                                                    key={value}
                                                    value={value}
                                                >
                                                    {label}
                                                </SelectItem>
                                            ),
                                        )}
                                    </SelectContent>
                                </Select>
                            </Field>
                            {supportsGroupSubtype(type) ? (
                                <Field>
                                    <FieldLabel htmlFor="group-subtype">
                                        Underkategori
                                    </FieldLabel>
                                    <Select
                                        items={[...GROUP_SUBTYPE_OPTIONS]}
                                        value={subtype}
                                        onValueChange={(value) =>
                                            setSubtype(value ?? subtype)
                                        }
                                    >
                                        <SelectTrigger id="group-subtype">
                                            <SelectValue placeholder="Velg underkategori" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {GROUP_SUBTYPE_OPTIONS.map(
                                                (option) => (
                                                    <SelectItem
                                                        key={option.value}
                                                        value={option.value}
                                                    >
                                                        {option.label}
                                                    </SelectItem>
                                                ),
                                            )}
                                        </SelectContent>
                                    </Select>
                                    <FieldDescription>
                                        Idrettsgrupper får sin egen seksjon i
                                        organisasjonskartet.
                                    </FieldDescription>
                                </Field>
                            ) : null}
                            <Field>
                                <FieldLabel id="group-description-label">
                                    Beskrivelse
                                </FieldLabel>
                                <RichEditor
                                    registry={richRegistry}
                                    value={description}
                                    onChange={setDescription}
                                    ariaLabelledBy="group-description-label"
                                />
                                <FieldDescription>
                                    Vises på «Om»-fanen til gruppen.
                                </FieldDescription>
                            </Field>
                        </FieldGroup>

                        {error && <p role="alert">{error}</p>}
                    </DialogBody>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Avbryt
                        </Button>
                        <Button
                            type="submit"
                            disabled={createGroup.isPending || !slug}
                        >
                            Opprett gruppe
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function GroupCard({
    group,
    expanded,
    onToggle,
}: {
    group: GroupWithMemberCount;
    expanded: boolean;
    onToggle: () => void;
}) {
    const [requiresSigning, setRequiresSigning] = useState(
        group.contractSigningRequired,
    );
    const [type, setType] = useState(group.type);
    const [subtype, setSubtype] = useState(groupSubtypeValue(group.subtype));
    const [logo, setLogo] = useState<File | null>(null);
    const [image, setImage] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);

    const updateGroup = useMutation(updateGroupMutation);
    const { uploadImage, isUploading } = useImageUploader();
    const isLeader = useIsGroupLeaderOf(group.slug);
    // Speiler PATCH /groups/:slug nøyaktig: `groups:update` globalt eller for
    // denne gruppa, eller å være lederen dens (`ownership: isGroupLeader`).
    const canEdit =
        useScopedPermission(
            ["groups:update", "groups:manage"],
            `group:${group.slug}`,
        ) || isLeader;
    // Medlemslista speiler fjern-endepunktet: `groups:manage` for denne gruppa,
    // eller å være lederen dens.
    const canManageMembers =
        useScopedPermission("groups:manage", `group:${group.slug}`) || isLeader;

    async function handleSave() {
        setError(null);
        try {
            const [logoUrl, imageUrl] = await Promise.all([
                logo ? uploadImage(logo) : undefined,
                image ? uploadImage(image) : undefined,
            ]);
            await updateGroup.mutateAsync({
                slug: group.slug,
                data: {
                    contractSigningRequired: requiresSigning,
                    ...(canEditGroupType(group.type)
                        ? {
                              type,
                              // Underkategorien gjelder bare interessegrupper;
                              // blir gruppa noe annet, må den ryddes bort.
                              subtype: supportsGroupSubtype(type)
                                  ? subtype
                                  : null,
                          }
                        : {}),
                    // Omitted when unchanged, so saving the checkbox never
                    // clears the group's existing logo or gruppebilde.
                    ...(logoUrl ? { logoUrl } : {}),
                    ...(imageUrl ? { imageUrl } : {}),
                },
            });
            setLogo(null);
            setImage(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    }

    const signaturesQuery = useQuery({
        ...getGroupSignaturesQuery(group.slug),
        enabled: expanded && requiresSigning,
    });

    return (
        <Card
            // The card *is* the collapsible root, so the panel below can roll
            // its height open instead of the content popping into place.
            // `gap-0` because the card's own gap would otherwise sit between the
            // header and a zero-height panel; the panel brings its own top
            // padding once it is open.
            className="gap-0"
            render={<Collapsible open={expanded} onOpenChange={onToggle} />}
        >
            <CardHeader>
                <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-col gap-1">
                        <CardTitle>{group.name}</CardTitle>
                        <CardDescription>
                            {groupTypeLabel(group.type)} · {group.memberCount}{" "}
                            {group.memberCount === 1 ? "medlem" : "medlemmer"}
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        {group.contractSigningRequired && (
                            <Badge variant="secondary">Kontrakt påkrevd</Badge>
                        )}
                        {group.finesActivated && (
                            <Badge variant="outline">Bøter aktivert</Badge>
                        )}
                        {canEdit ? (
                            <CollapsibleTrigger
                                render={<Button variant="outline" size="sm" />}
                            >
                                {expanded ? "Lukk" : "Rediger"}
                            </CollapsibleTrigger>
                        ) : null}
                    </div>
                </div>
            </CardHeader>
            <CollapsibleContent>
                <CardContent className="flex flex-col gap-6 pt-4">
                    <FieldGroup>
                        <Field orientation="horizontal" className="gap-3">
                            <Checkbox
                                id={`signing-${group.slug}`}
                                checked={requiresSigning}
                                onCheckedChange={(checked) =>
                                    setRequiresSigning(Boolean(checked))
                                }
                            />
                            <FieldLabel htmlFor={`signing-${group.slug}`}>
                                Krev kontraktsignering for denne gruppen
                            </FieldLabel>
                        </Field>
                        {canEditGroupType(group.type) ? (
                            <Field>
                                <FieldLabel htmlFor={`type-${group.slug}`}>
                                    Gruppetype
                                </FieldLabel>
                                <Select
                                    items={[...GROUP_TYPE_OPTIONS]}
                                    value={type}
                                    onValueChange={(value) =>
                                        setType(value ?? type)
                                    }
                                >
                                    <SelectTrigger id={`type-${group.slug}`}>
                                        <SelectValue placeholder="Velg type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {GROUP_TYPE_OPTIONS.map((option) => (
                                            <SelectItem
                                                key={option.value}
                                                value={option.value}
                                            >
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FieldDescription>
                                    Bestemmer hvor gruppen står i
                                    organisasjonskartet. Gruppen flytter seg til
                                    fanen for den nye typen.
                                </FieldDescription>
                            </Field>
                        ) : null}
                        {canEditGroupType(group.type) &&
                        supportsGroupSubtype(type) ? (
                            <Field>
                                <FieldLabel htmlFor={`subtype-${group.slug}`}>
                                    Underkategori
                                </FieldLabel>
                                <Select
                                    items={[...GROUP_SUBTYPE_OPTIONS]}
                                    value={subtype}
                                    onValueChange={(value) =>
                                        setSubtype(
                                            (value as typeof subtype) ??
                                                subtype,
                                        )
                                    }
                                >
                                    <SelectTrigger id={`subtype-${group.slug}`}>
                                        <SelectValue placeholder="Velg underkategori" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {GROUP_SUBTYPE_OPTIONS.map((option) => (
                                            <SelectItem
                                                key={option.value}
                                                value={option.value}
                                            >
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FieldDescription>
                                    Idrettsgrupper får sin egen seksjon i
                                    organisasjonskartet.
                                </FieldDescription>
                            </Field>
                        ) : null}
                        {/* Logo takes a third of the row and the gruppebilde
                            the rest, so the square and the 16:9 frame end up
                            roughly the same height and sit side by side
                            instead of stacking into two tall blocks. The
                            subgrid keeps the two frames on the same line even
                            when one column's label wraps and the other's
                            does not. */}
                        <div className="grid max-w-xl grid-cols-3 grid-rows-[auto_auto_auto] gap-x-4 gap-y-2">
                            <AdminImageField
                                className="col-span-1 row-span-3 grid grid-rows-subgrid gap-2"
                                label="Logo (la stå tom for å beholde)"
                                description="Vises som profilbilde i avatarer, kort og lister."
                                preset="avatar"
                                value={logo}
                                onChange={setLogo}
                                existingImageUrl={group.logoUrl}
                                disabled={updateGroup.isPending || isUploading}
                            />
                            <AdminImageField
                                className="col-span-2 row-span-3 grid grid-rows-subgrid gap-2"
                                label="Gruppebilde (la stå tom for å beholde)"
                                description="Bilde av gruppa. Vises øverst på Om-fanen."
                                preset="cover-video"
                                value={image}
                                onChange={setImage}
                                existingImageUrl={group.imageUrl}
                                disabled={updateGroup.isPending || isUploading}
                            />
                        </div>
                    </FieldGroup>
                    {error && (
                        <p className="text-sm text-destructive" role="alert">
                            {error}
                        </p>
                    )}
                    <Button
                        className="self-start"
                        disabled={updateGroup.isPending || isUploading}
                        onClick={handleSave}
                    >
                        {isUploading ? "Laster opp bilde …" : "Lagre"}
                    </Button>
                    {canManageMembers && (
                        <GroupMembersTable
                            groupSlug={group.slug}
                            enabled={expanded}
                        />
                    )}
                    {requiresSigning &&
                        (signaturesQuery.data ? (
                            <MemberSigningTable
                                groupSlug={group.slug}
                                signatures={signaturesQuery.data}
                            />
                        ) : (
                            <p>Laster signeringsstatus…</p>
                        ))}
                </CardContent>
            </CollapsibleContent>
        </Card>
    );
}

const ROLE_LABELS: Record<string, string> = {
    leader: "Leder",
    member: "Medlem",
};

/**
 * Medlemslista til gruppa, med mulighet for å ta noen ut av den.
 *
 * Medlemskapet havner i «Tidligere medlemmer» når det avsluttes, så
 * vervhistorikken består selv om personen ikke lenger står i gruppa. Rollen
 * gruppa gir i rettighetssystemet trekkes tilbake samtidig.
 */
function GroupMembersTable({
    groupSlug,
    /** Lista hentes først når kortet er åpnet. */
    enabled,
}: {
    groupSlug: string;
    enabled: boolean;
}) {
    const { data: members, isPending } = useQuery({
        ...getGroupMembersQuery(groupSlug, 0),
        enabled,
    });
    const remove = useMutation(removeGroupMemberMutation);
    const [confirming, setConfirming] = useState<GroupMember | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function handleRemove() {
        if (!confirming) return;
        setError(null);
        try {
            await remove.mutateAsync({
                groupSlug,
                userId: confirming.userId,
            });
            setConfirming(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    }

    if (isPending) {
        return (
            <div className="flex flex-col gap-2">
                {Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={index} className="h-9 w-full" />
                ))}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            <h4>Medlemmer</h4>
            {!members || members.length === 0 ? (
                <p>Ingen medlemmer i denne gruppen.</p>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Navn</TableHead>
                            <TableHead>Rolle</TableHead>
                            <TableHead />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {members.map((member) => (
                            <TableRow key={member.userId}>
                                <TableCell>
                                    <div className="flex flex-col gap-0.5">
                                        <span>{member.user.name}</span>
                                        {member.user.studyProgram && (
                                            <span>
                                                {member.user.studyProgram}
                                            </span>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {ROLE_LABELS[member.role] ?? member.role}
                                </TableCell>
                                <TableCell>
                                    <div className="flex justify-end">
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            disabled={remove.isPending}
                                            onClick={() => {
                                                setError(null);
                                                setConfirming(member);
                                            }}
                                        >
                                            <Trash2 className="size-4" />
                                            Fjern
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}

            <Dialog
                open={confirming !== null}
                onOpenChange={(open) => {
                    if (!open) setConfirming(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Fjern fra gruppen</DialogTitle>
                    </DialogHeader>
                    <p>
                        {confirming?.user.name} mister plassen sin i gruppen og
                        rettighetene som følger med den. Medlemskapet blir
                        liggende under «Tidligere medlemmer».
                    </p>
                    {error && (
                        <p className="text-sm text-destructive" role="alert">
                            {error}
                        </p>
                    )}
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setConfirming(null)}
                        >
                            Avbryt
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            disabled={remove.isPending}
                            onClick={handleRemove}
                        >
                            Fjern
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function MemberSigningTable({
    groupSlug,
    signatures,
}: {
    groupSlug: string;
    signatures: GroupSignatureList;
}) {
    const revokeSignature = useMutation(revokeSignatureMutation);
    // Mirrors revoke-signature server-side: `contracts:manage` (global or for
    // this group) or being the group's leader.
    const isLeader = useIsGroupLeaderOf(groupSlug);
    const canRevoke =
        useScopedPermission("contracts:manage", `group:${groupSlug}`) ||
        isLeader;

    if (!signatures.members.length) {
        return <p>Ingen medlemmer i denne gruppen.</p>;
    }

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <h4>Signeringsstatus</h4>
                <span>
                    {signatures.signedCount} / {signatures.totalMembers} signert
                </span>
            </div>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Navn</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Signert</TableHead>
                        <TableHead />
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {signatures.members.map((member) => (
                        <MemberRow
                            key={member.userId}
                            member={member}
                            disabled={revokeSignature.isPending}
                            onRevoke={
                                canRevoke
                                    ? () =>
                                          revokeSignature.mutate({
                                              groupSlug,
                                              userId: member.userId,
                                          })
                                    : undefined
                            }
                        />
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

function MemberRow({
    member,
    disabled,
    onRevoke,
}: {
    member: GroupSignatureMember;
    disabled: boolean;
    /** Omitted when the viewer may not revoke — no button then. */
    onRevoke?: () => void;
}) {
    return (
        <TableRow>
            <TableCell>
                <div className="flex flex-col gap-0.5">
                    <span>{member.userName}</span>
                    <span>{member.userEmail}</span>
                </div>
            </TableCell>
            <TableCell>
                {member.hasSigned ? (
                    <span className="flex items-center gap-1">
                        <CheckCircle2 className="size-4" />
                        Signert
                    </span>
                ) : (
                    <span className="flex items-center gap-1">
                        <XCircle className="size-4" />
                        Ikke signert
                    </span>
                )}
            </TableCell>
            <TableCell>
                {member.signedAt
                    ? new Date(member.signedAt).toLocaleDateString(
                          "nb-NO",
                          OSLO_DATE_OPTIONS,
                      )
                    : "—"}
            </TableCell>
            <TableCell>
                {member.hasSigned && onRevoke && (
                    <Button
                        size="sm"
                        variant="destructive"
                        disabled={disabled}
                        onClick={onRevoke}
                    >
                        Trekk tilbake
                    </Button>
                )}
            </TableCell>
        </TableRow>
    );
}
