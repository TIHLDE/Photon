"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"

export default function ContactForm() {
    const [formData, setFormData] = useState({
        company: "",
        contactPerson: "",
        email: "",
        phone: "",
        message: "",
    })

    const [interests, setInterests] = useState({
        companyPresentation: false,
        workshop: false,
        companyVisit: false,
        advertisement: false,
        collaboration: false,
        other: false,
    })

    const [timeframe, setTimeframe] = useState({
        q1: false,
        q2: false,
        q3: false,
        q4: false,
    })

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()

        console.log({ formData, interests, timeframe })

        // toast({
        //     title: "Form submitted",
        //     description: "We'll get back to you as soon as possible.",
        // })
    }

    return (
        <Card className="border-0 overflow-hidden bg-slate-800/50">
            <CardContent className="p-0 border-0">
                <div className="p-6">
                    <h2 className="text-2xl font-bold">Ta kontakt med oss</h2>
                    <p className="text-sm text-slate-300">Fyll ut kontaktskjemaet, så hører du fra oss straks.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8 p-6">
                    <div className="grid gap-6 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="company" className="text-sm font-medium">
                                Bedrift <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="company"
                                placeholder="Navn på bedriften"
                                className="bg-slate-900 text-white placeholder:text-slate-500"
                                value={formData.company}
                                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="contactPerson" className="text-sm font-medium">
                                Kontaktperson <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="contactPerson"
                                placeholder="Fullt navn"
                                className="bg-slate-900 border-0 text-white placeholder:text-slate-500"
                                value={formData.contactPerson}
                                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-sm font-medium">
                                E-post <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="eksempel@bedrift.com"
                                className="bg-slate-900 border-0 text-white placeholder:text-slate-500"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="phone" className="text-sm font-medium">
                                Telefonnummer
                            </Label>
                            <Input
                                id="phone"
                                type="tel"
                                placeholder="+47 987 65 432"
                                className="bg-slate-900 border-0 text-white placeholder:text-slate-500"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                        <div className="space-y-4">
                            <Label className="text-sm font-medium">
                                Tidsramme
                            </Label>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="q1"
                                        checked={timeframe.q1}
                                        onCheckedChange={(checked) => setTimeframe({ ...timeframe, q1: checked as boolean })}
                                    />
                                    <label htmlFor="q1" className="text-sm">
                                        Q1 (jan-mar)
                                    </label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="q2"
                                        checked={timeframe.q2}
                                        onCheckedChange={(checked) => setTimeframe({ ...timeframe, q2: checked as boolean })}
                                    />
                                    <label htmlFor="q2" className="text-sm">
                                        Q2 (apr-jun)
                                    </label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="q3"
                                        checked={timeframe.q3}
                                        onCheckedChange={(checked) => setTimeframe({ ...timeframe, q3: checked as boolean })}
                                    />
                                    <label htmlFor="q3" className="text-sm">
                                        Q3 (aug-sep)
                                    </label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="q4"
                                        checked={timeframe.q4}
                                        onCheckedChange={(checked) => setTimeframe({ ...timeframe, q4: checked as boolean })}
                                    />
                                    <label htmlFor="q4" className="text-sm">
                                        Q4 (okt-des)
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <Label className="text-sm font-medium">
                                Interesser
                            </Label>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="companyPresentation"
                                        checked={interests.companyPresentation}
                                        onCheckedChange={(checked) =>
                                            setInterests({ ...interests, companyPresentation: checked as boolean })
                                        }
                                    />
                                    <label htmlFor="companyPresentation" className="text-sm">
                                        Bedriftspresentasjon
                                    </label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="workshop"
                                        checked={interests.workshop}
                                        onCheckedChange={(checked) => setInterests({ ...interests, workshop: checked as boolean })}
                                    />
                                    <label htmlFor="workshop" className="text-sm">
                                        Kurs og workshop
                                    </label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="advertisement"
                                        checked={interests.advertisement}
                                        onCheckedChange={(checked) => setInterests({ ...interests, advertisement: checked as boolean })}
                                    />
                                    <label htmlFor="advertisement" className="text-sm">
                                        Jobbannonse
                                    </label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="companyExcursion"
                                        checked={interests.collaboration}
                                        onCheckedChange={(checked) => setInterests({ ...interests, collaboration: checked as boolean })}
                                    />
                                    <label htmlFor="companyExcursion" className="text-sm">
                                        Bedriftsekskursjon
                                    </label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="other"
                                        checked={interests.other}
                                        onCheckedChange={(checked) => setInterests({ ...interests, other: checked as boolean })}
                                    />
                                    <label htmlFor="other" className="text-sm">
                                        Annet
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="message" className="text-sm font-medium">
                            Melding
                        </Label>
                        <Textarea
                            id="message"
                            placeholder="Utfyllende beskrivelse"
                            className="min-h-[120px] bg-slate-900 border-0 text-white placeholder:text-slate-500"
                            value={formData.message}
                            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        />
                    </div>

                    <Button
                        type="submit"
                        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700"
                    >
                        Send
                    </Button>
                </form>
            </CardContent>
        </Card>
    )
}

