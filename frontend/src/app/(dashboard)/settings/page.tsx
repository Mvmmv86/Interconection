'use client';

import Link from 'next/link';
import { Shield, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function SettingsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-text-muted">Admin</p>
        <h1 className="text-2xl font-semibold text-text-primary mt-1">Settings</h1>
        <p className="text-sm text-text-secondary mt-2">
          Gerencie conta, equipe e permissões da organização ativa.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card variant="glass" hoverable>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-4 h-4 text-accent-blue" />
              Team
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-text-secondary">
              Convide membros, altere papéis e limite acesso por carteira.
            </p>
            <Link href="/settings/team">
              <Button size="sm">Abrir equipe</Button>
            </Link>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-accent-purple" />
              Segurança
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-text-secondary">
              Políticas avançadas e auditoria entram nas próximas fases do plano RBAC.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
