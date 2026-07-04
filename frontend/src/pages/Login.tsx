import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Form, Input, Button, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      await login(values.email, values.password);
      navigate('/');
    } catch (err: any) {
      message.error(err.message || t('auth.invalidCredentials'));

    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-split">
      {/* Left: Brand / hero */}
      <aside className="hidden lg:flex flex-col justify-between bg-bg-elevated text-fg-inverse p-14 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-accent-primary/40 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/4" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-8 h-8 rounded-lg bg-accent-primary" />
            <span className="text-xl font-semibold tracking-tight">{t('common.appName')}</span>
          </div>

          <h1 className="text-5xl lg:text-6xl font-bold tracking-tighter leading-none mb-6">
            {t('auth.heroTitle')}
            <br />
            {t('auth.heroTitleLine2')}
            <br />
            <span className="text-accent-primary">{t('auth.heroTitleLine3')}</span>
          </h1>

          <p className="text-lg text-fg-tertiary leading-relaxed max-w-md">
            {t('auth.heroSubtitle')}
          </p>
        </div>

        <p className="relative z-10 text-sm text-fg-secondary">
          {t('auth.heroFooter')}
        </p>
      </aside>

      {/* Right: Form */}
      <main className="flex items-center justify-center px-8 py-16 bg-bg-elevated">
        <div className="w-full max-w-[400px] animate-fade-in">
          {/* Mobile-only logo */}
          <div className="lg:hidden flex items-center gap-3 mb-12">
            <div className="w-7 h-7 rounded-lg bg-accent-primary" />
            <span className="text-lg font-semibold tracking-tight text-fg-primary">{t('common.appName')}</span>
          </div>

          <div className="mb-10">
            <h2 className="text-3xl font-bold tracking-tight text-fg-primary mb-2">{t('auth.welcomeBack')}</h2>
            <p className="text-fg-tertiary">{t('auth.signInToOrg')}</p>
          </div>

          <Form layout="vertical" onFinish={onFinish} size="large" requiredMark={false}>
            <Form.Item
              name="email"
              label={<span className="text-sm font-medium text-fg-secondary">{t('auth.email')}</span>}
              rules={[{ required: true, message: t('auth.enterEmail') }]}
            >
              <Input
                placeholder={t('auth.emailPlaceholder')}
                autoComplete="email"
                className="h-11"
              />
            </Form.Item>

            <Form.Item
              name="password"
              label={<span className="text-sm font-medium text-fg-secondary">{t('auth.password')}</span>}
              rules={[{ required: true, message: t('auth.enterPassword') }]}
            >
              <Input.Password
                placeholder={t('auth.passwordPlaceholder')}
                autoComplete="current-password"
                className="h-11"
              />
            </Form.Item>

            <Form.Item className="mb-4">
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                className="h-11 font-medium text-base"
              >
                {t('auth.signIn')}
              </Button>
            </Form.Item>
          </Form>

          <p className="text-center text-sm text-fg-tertiary">
            {t('auth.noAccount')}{' '}
            <Link to="/register" className="text-accent-primary font-medium hover:text-accent-primary transition-colors">
              {t('auth.createOrg')}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
