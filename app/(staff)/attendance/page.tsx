"use client";

import { useMock } from "../../../lib/mock-store";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Avatar, AvatarFallback } from "../../../components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Clock, LogIn, LogOut } from "lucide-react";
import { initials, avatarColor } from "../../../lib/format";

export default function AttendancePage() {
  const { employees, attendance, toggleClock } = useMock();
  const today = new Date().toISOString().slice(0, 10);

  const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "—";

  const present = attendance.filter((a) => a.date === today && a.clock_in);
  const clockedOut = present.filter((a) => a.clock_out).length;
  const stillIn = present.length - clockedOut;
  const absent = employees.length - present.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Attendance</h1>
        <p className="text-muted-foreground mt-1">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat label="Present" value={present.length} tone="success" />
        <Stat label="Currently in" value={stillIn} tone="primary" />
        <Stat label="Absent" value={absent} tone="warning" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Today's roster</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Employee</TableHead><TableHead>Department</TableHead>
              <TableHead>Clock in</TableHead><TableHead>Clock out</TableHead>
              <TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {employees.map((e) => {
                const a = attendance.find((x) => x.employee_id === e.id && x.date === today);
                const status = !a?.clock_in ? "absent" : a.clock_out ? "out" : "in";
                return (
                  <TableRow key={e.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8"><AvatarFallback className={avatarColor(e.full_name)}>{initials(e.full_name)}</AvatarFallback></Avatar>
                        <div>
                          <div className="font-medium text-sm">{e.full_name}</div>
                          <div className="text-xs text-muted-foreground">{e.designation}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline">{e.department}</Badge></TableCell>
                    <TableCell className="font-mono text-sm">{fmt(a?.clock_in ?? null)}</TableCell>
                    <TableCell className="font-mono text-sm">{fmt(a?.clock_out ?? null)}</TableCell>
                    <TableCell>
                      {status === "in" && <Badge className="bg-success text-success-foreground"><Clock className="h-3 w-3 mr-1" /> Working</Badge>}
                      {status === "out" && <Badge variant="secondary">Done</Badge>}
                      {status === "absent" && <Badge variant="outline" className="text-muted-foreground">Not in</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      {status === "absent" && <Button size="sm" variant="outline" onClick={() => toggleClock(e.id)}><LogIn className="h-3.5 w-3.5 mr-1" /> Clock in</Button>}
                      {status === "in" && <Button size="sm" onClick={() => toggleClock(e.id)}><LogOut className="h-3.5 w-3.5 mr-1" /> Clock out</Button>}
                      {status === "out" && <span className="text-xs text-muted-foreground">Completed</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "success" | "primary" | "warning" }) {
  const cls = { success: "bg-success/10 text-success", primary: "bg-primary/10 text-primary", warning: "bg-warning/15 text-warning-foreground" }[tone];
  return (
    <Card><CardContent className="p-5 flex items-center justify-between">
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-3xl font-bold mt-1">{value}</p>
      </div>
      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${cls}`}><Clock className="h-5 w-5" /></div>
    </CardContent></Card>
  );
}
