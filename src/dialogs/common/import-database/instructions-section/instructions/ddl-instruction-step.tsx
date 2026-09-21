import React from 'react';
import { useTranslation } from 'react-i18next';
import { CodeSnippet } from '@/components/code-snippet/code-snippet';

export interface DDLInstructionStepProps {
    index: number;
    text: string;
    code?: string;
    example?: string;
}

export const DDLInstructionStep: React.FC<DDLInstructionStepProps> = ({
    index,
    text,
    code,
    example,
}) => {
    const { t } = useTranslation();
    return (
        <div className="flex flex-col gap-1">
            <div className="flex flex-col gap-1 text-sm text-primary">
                <div>
                    <span className="font-medium">{index}.</span> {text}
                </div>

                {code ? (
                    <div className="h-[60px]">
                        <CodeSnippet
                            className="h-full"
                            code={code}
                            language={'shell'}
                        />
                    </div>
                ) : null}
                {example ? (
                    <>
                        <div className="my-2">
                            {t('new_diagram_dialog.import_database.example')}
                        </div>
                        <div className="h-[60px]">
                            <CodeSnippet
                                className="h-full"
                                code={example}
                                language={'shell'}
                            />
                        </div>
                    </>
                ) : null}
            </div>
        </div>
    );
};
