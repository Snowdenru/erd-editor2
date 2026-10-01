import React, { useEffect, useState } from 'react';
import { ConfigContext } from './config-context';

import { useStorage } from '@/hooks/use-storage';
import type { ChartDBConfig } from '@/lib/domain/config';
import { setLastDiagramId } from '@/lib/last-diagram';

export const ConfigProvider: React.FC<React.PropsWithChildren> = ({
    children,
}) => {
    const {
        getConfig,
        getDiagram,
        updateConfig: updateDataConfig,
    } = useStorage();
    const [config, setConfig] = useState<ChartDBConfig | undefined>();

    useEffect(() => {
        const loadConfig = async () => {
            const config = await getConfig();
            if (config?.defaultDiagramId) {
                const exists = await getDiagram(config.defaultDiagramId);
                setLastDiagramId(exists ? config.defaultDiagramId : '');
            }
            setConfig(config);
        };

        loadConfig();
    }, [getConfig, getDiagram]);

    const updateConfig: ConfigContext['updateConfig'] = async ({
        config,
        updateFn,
    }) => {
        const promise = new Promise<void>((resolve) => {
            setConfig((prevConfig) => {
                let baseConfig: ChartDBConfig = { defaultDiagramId: '' };
                if (prevConfig) {
                    baseConfig = prevConfig;
                }

                const updatedConfig = updateFn
                    ? updateFn(baseConfig)
                    : { ...baseConfig, ...config };

                setLastDiagramId(updatedConfig.defaultDiagramId);
                updateDataConfig(updatedConfig).then(() => {
                    resolve();
                });
                return updatedConfig;
            });
        });

        return promise;
    };

    return (
        <ConfigContext.Provider
            value={{
                config,
                updateConfig,
            }}
        >
            {children}
        </ConfigContext.Provider>
    );
};
