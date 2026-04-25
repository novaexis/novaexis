import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, Phone, MapPin, MessageSquare } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Lead {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  municipio: string | null;
  cargo: string | null;
  origem: string;
  status: string;
  observacoes: string | null;
  created_at: string;
}

const COLUNAS = [
  { id: "novo", label: "Novos", cor: "border-amber-500/40" },
  { id: "qualificado", label: "Qualificados", cor: "border-blue-500/40" },
  { id: "em_negociacao", label: "Em negociação", cor: "border-purple-500/40" },
  { id: "convertido", label: "Convertidos", cor: "border-emerald-500/40" },
  { id: "perdido", label: "Perdidos", cor: "border-red-500/40" },
];

export function CRMLeadsManager() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);

  useEffect(() => {
    void carregar();
  }, []);

  async function carregar() {
    setLoading(true);
    const { data, error } = await supabase
      .from("leads_comerciais")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Falha ao carregar leads");
    }
    setLeads(data ?? []);
    setLoading(false);
  }

  async function mudarStatus(id: string, status: string) {
    const originalLeads = [...leads];
    
    // Optimistic update
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));

    const { error } = await supabase
      .from("leads_comerciais")
      .update({ status })
      .eq("id", id);

    if (error) {
      setLeads(originalLeads);
      toast.error("Falha ao atualizar");
      return;
    }
    
    toast.success("Status atualizado");
  }

  const handleDragStart = (leadId: string) => {
    setDraggedLeadId(leadId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (status: string) => {
    if (draggedLeadId) {
      const lead = leads.find(l => l.id === draggedLeadId);
      if (lead && lead.status !== status) {
        void mudarStatus(draggedLeadId, status);
      }
      setDraggedLeadId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Pipeline comercial</h2>
          <p className="text-sm text-muted-foreground">
            {leads.length} leads · arraste os cartões entre as colunas
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={carregar}>
          Atualizar
        </Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-5 min-h-[500px]">
        {COLUNAS.map((col) => {
          const items = leads.filter((l) => l.status === col.id);
          return (
            <div 
              key={col.id} 
              className={cn(
                "rounded-lg border-t-2 bg-muted/30 p-2 transition-colors duration-200", 
                col.cor,
                draggedLeadId && "hover:bg-muted/50 border-dashed"
              )}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(col.id)}
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="text-xs font-semibold uppercase">{col.label}</p>
                <Badge variant="secondary" className="text-xs">{items.length}</Badge>
              </div>
              <div className="space-y-2 min-h-[100px]">
                {items.length === 0 && (
                  <p className="px-1 py-3 text-center text-xs text-muted-foreground border border-dashed rounded-md">
                    Arraste aqui
                  </p>
                )}
                {items.map((l) => (
                  <Card 
                    key={l.id} 
                    className={cn(
                      "p-3 text-xs cursor-move hover:shadow-md transition-all active:scale-95",
                      draggedLeadId === l.id && "opacity-50 grayscale"
                    )}
                    draggable
                    onDragStart={() => handleDragStart(l.id)}
                  >
                    <p className="font-semibold text-sm">{l.nome}</p>
                    {l.cargo && <p className="text-muted-foreground">{l.cargo}</p>}
                    <div className="mt-2 space-y-1 text-muted-foreground">
                      <p className="flex items-center gap-1.5"><Mail className="h-3 w-3" />{l.email}</p>
                      {l.telefone && <p className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{l.telefone}</p>}
                      {l.municipio && <p className="flex items-center gap-1.5"><MapPin className="h-3 w-3" />{l.municipio}</p>}
                      {l.observacoes && (
                        <p className="flex items-start gap-1.5">
                          <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
                          <span className="line-clamp-2">{l.observacoes}</span>
                        </p>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px]">{l.origem}</Badge>
                      <Select value={l.status} onValueChange={(v) => mudarStatus(l.id, v)}>
                        <SelectTrigger className="h-7 flex-1 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {COLUNAS.map((c) => (
                            <SelectItem key={c.id} value={c.id} className="text-xs">{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
