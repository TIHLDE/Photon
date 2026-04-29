import { Card } from "@tihlde/ui/ui/card";

import { GroupMembersOverTimeChart } from "#/components/group-members-over-time-chart";
import { GroupPageHeader } from "#/components/group-page-header";
import { GroupStudyOverTimeChart } from "#/components/group-study-over-time-chart";
import { GroupStudyRadarChart } from "#/components/group-study-radar-chart";

export function GroupOmTab() {
    return (
        <div className="flex flex-col gap-6">
            <GroupPageHeader title="Om" />
            <div className="grid gap-6 md:grid-cols-2">
                <div className="flex flex-col gap-6">
                    <Card className="overflow-hidden p-0">
                        <img
                            src="/index-group.jpg"
                            alt="Index"
                            className="aspect-video size-full object-cover"
                        />
                    </Card>
                    <GroupMembersOverTimeChart />
                    <GroupStudyOverTimeChart />
                </div>

                <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-3">
                        <h3 className="text-lg font-medium">Hva gjør Index?</h3>
                        <p className="text-sm text-muted-foreground">
                            Index er undergruppen i TIHLDE som drifter og
                            utvikler linjeforeningens digitale plattformer — fra
                            nettsiden du er inne på akkurat nå, til interne
                            verktøy som binder sammen arrangementer, opptak,
                            økonomi og kommunikasjon. Vi jobber smidig i
                            tverrfaglige team, eksperimenterer med moderne
                            verktøy og rammeverk, og prøver å gjøre det enklere
                            å være medlem i TIHLDE. Mye av det vi lager er åpen
                            kildekode, og vi tar gjerne imot bidrag og innspill
                            fra resten av foreningen.
                        </p>
                    </div>
                    <GroupStudyRadarChart />
                </div>
            </div>
        </div>
    );
}
