'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CheckCircle2, Shield, UserPlus } from 'lucide-react';
import { api } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function AcceptInvitationPage() {
  const params = useParams<{ token: string }>();
  const token = useMemo(() => String(params?.token || ''), [params?.token]);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [createdUser, setCreatedUser] = useState(false);

  const acceptInvite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const result = await api.acceptTeamInvitation(token, {
      name: name || undefined,
      password: password || undefined,
    });

    if (!result.success || !result.data) {
      setError(result.error || 'Nao foi possivel aceitar o convite');
      setIsSubmitting(false);
      return;
    }

    setCreatedUser(result.data.created_user);
    setAccepted(true);
    setIsSubmitting(false);
  };

  return (
    <main className="min-h-screen bg-background-primary flex items-center justify-center px-4 py-10">
      <Card variant="glass-elevated" className="w-full max-w-lg">
        <CardContent className="p-8">
          {accepted ? (
            <div className="text-center space-y-5">
              <div className="w-14 h-14 rounded-2xl bg-status-success/15 text-status-success flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-text-primary">Convite aceito</h1>
                <p className="text-sm text-text-secondary mt-2">
                  {createdUser
                    ? 'Sua conta foi criada e vinculada a equipe.'
                    : 'Seu usuario existente foi vinculado a nova conta.'}
                </p>
              </div>
              <Link href="/login">
                <Button>Ir para login</Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={acceptInvite} className="space-y-6">
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-accent-blue/15 text-accent-blue flex items-center justify-center mx-auto">
                  <UserPlus className="w-7 h-7" />
                </div>
                <h1 className="text-2xl font-semibold text-text-primary mt-5">Aceitar convite</h1>
                <p className="text-sm text-text-secondary mt-2">
                  Se voce ja possui conta com o email convidado, pode aceitar sem preencher nome e senha.
                  Para novo usuario, informe os dados abaixo.
                </p>
              </div>

              {error && (
                <div className="rounded-xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <Input
                  label="Nome"
                  placeholder="Seu nome"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  disabled={isSubmitting}
                />
                <Input
                  label="Senha"
                  type="password"
                  placeholder="Minimo de 8 caracteres"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={isSubmitting}
                  hint="Necessaria apenas para usuarios novos."
                />
              </div>

              <Button type="submit" className="w-full" isLoading={isSubmitting}>
                <Shield className="w-4 h-4" />
                Aceitar convite
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
