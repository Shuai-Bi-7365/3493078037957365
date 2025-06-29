// ==UserScript==
// @name         卫星地图
// @namespace    https://github.com/Shuai-Bi-7365/3493078037957365
// @version      1.3
// @description  超级牛逼无敌豪华至尊pro plus max版
// @author       ShuaiBi
// @match        https://www.geo-fs.com/geofs.php*
// @grant        none
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// ==/UserScript==

(function() {
    'use strict';
    
    // 配置存储键名
    const CONFIG_STORAGE_KEY = 'geoFSEnhancedMapConfig';
    
    // 默认配置
    const DEFAULT_CONFIG = {
        mapSource: "arcgis",  // arcgis, google, amap
        updateInterval: 2000,
        focusRadius: 15000,
        cameraRadius: 8000,
        showPanel: false
    };

    // 获取配置（使用localStorage）
    function getConfig() {
        try {
            const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
            if (saved) {
                return {...DEFAULT_CONFIG, ...JSON.parse(saved)};
            }
        } catch (e) {
            console.error('读取配置出错:', e);
        }
        return {...DEFAULT_CONFIG};
    }
    
    // 保存配置
    function saveConfig(config) {
        try {
            localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
            return true;
        } catch (e) {
            console.error('保存配置出错:', e);
            return false;
        }
    }
    
    // 当前配置
    let config = getConfig();

    // 地图源定义
    const MAP_SOURCES = {
        arcgis: {
            name: "ArcGIS卫星地图",
            provider: () => new Cesium.ArcGisMapServerImageryProvider({
                url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
                maximumLevel: 19,
                credit: "Esri, Maxar, Earthstar Geographics"
            })
        },
        google: {
            name: "Google卫星地图",
            provider: () => new Cesium.UrlTemplateImageryProvider({
                url: "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
                maximumLevel: 20,
                credit: "Google"
            })
        },
        amap: {
            name: "高德卫星地图",
            provider: () => new Cesium.UrlTemplateImageryProvider({
                url: "https://webst02.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}",
                maximumLevel: 18,
                credit: "高德地图"
            })
        }
    };

    // 状态变量
    let aircraftPosition = null;
    let updateTimer = null;
    let isPanelVisible = config.showPanel;
    let isInitialized = false;

    // 添加CSS样式
    function addStyles() {
        const style = document.createElement('style');
        style.id = 'geo-fs-enhanced-map-styles';
        style.textContent = `
            #geoFS-settings-panel {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0, 0, 0, 0.9);
                color: white;
                padding: 20px;
                border-radius: 12px;
                z-index: 99999;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                box-shadow: 0 0 25px rgba(0, 0, 0, 0.8);
                display: none;
                width: 380px;
                max-height: 85vh;
                overflow-y: auto;
                border: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            #geoFS-settings-panel h1 {
                font-size: 22px;
                margin: 0 0 15px 0;
                text-align: center;
                color: #4CAF50;
                font-weight: 600;
                letter-spacing: 0.5px;
            }
            
            #geoFS-settings-panel h2 {
                font-size: 16px;
                margin: 0 0 15px 0;
                text-align: center;
                color: rgba(255, 255, 255, 0.7);
                font-weight: 400;
            }
            
            .geoFS-setting-row {
                margin-bottom: 18px;
            }
            
            .geoFS-setting-row label {
                display: block;
                margin-bottom: 8px;
                font-size: 14px;
                color: rgba(255, 255, 255, 0.9);
            }
            
            .geoFS-setting-row input, 
            .geoFS-setting-row select {
                width: 100%;
                padding: 10px 12px;
                border-radius: 6px;
                border: 1px solid rgba(255, 255, 255, 0.2);
                background: rgba(0, 0, 0, 0.5);
                color: white;
                font-size: 14px;
                transition: border 0.2s;
            }
            
            .geoFS-setting-row input:focus, 
            .geoFS-setting-row select:focus {
                outline: none;
                border-color: #4CAF50;
                box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.2);
            }
            
            .geoFS-setting-row input[type="number"]::-webkit-inner-spin-button,
            .geoFS-setting-row input[type="number"]::-webkit-outer-spin-button {
                -webkit-appearance: none;
                margin: 0;
            }
            
            .geoFS-unit {
                font-size: 12px;
                color: rgba(255, 255, 255, 0.6);
                margin-left: 5px;
            }
            
            .geoFS-buttons {
                display: flex;
                gap: 12px;
                margin-top: 25px;
            }
            
            .geoFS-btn {
                flex: 1;
                padding: 12px;
                border-radius: 6px;
                border: none;
                cursor: pointer;
                font-weight: 600;
                font-size: 14px;
                transition: all 0.2s;
            }
           
            #geoFS-save-btn {
                background: #4CAF50;
                color: white;
            }
            
            #geoFS-save-btn:hover {
                background: #45a049;
                transform: translateY(-1px);
            }
            
            #geoFS-clear-cache-btn {
                background: rgba(255, 255, 255, 0.1);
                color: white;
            }
            
            #geoFS-clear-cache-btn:hover {
                background: rgba(255, 255, 255, 0.2);
                transform: translateY(-1px);
            }
            
            #geoFS-close-btn {
                background: rgba(255, 255, 255, 0.1);
                color: white;
            }
            
            #geoFS-close-btn:hover {
                background: rgba(255, 255, 255, 0.2);
                transform: translateY(-1px);
            }
            
            #geoFS-notification {
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 12px 20px;
                border-radius: 6px;
                z-index: 99999;
                font-size: 14px;
                display: none;
                animation: slideUp 0.3s ease;
                border-left: 4px solid #4CAF50;
            }
            
            @keyframes slideUp {
                from { opacity: 0; transform: translate(-50%, 20px); }
                to { opacity: 1; transform: translate(-50%, 0); }
            }
        `;
        document.head.appendChild(style);
    }

    // 显示通知
    function showNotification(message, duration = 3000) {
        const notification = document.getElementById('geoFS-notification') || createNotification();
        notification.textContent = message;
        notification.style.display = 'block';
        
        setTimeout(() => {
            notification.style.display = 'none';
        }, duration);
    }
    
    function createNotification() {
        const notification = document.createElement('div');
        notification.id = 'geoFS-notification';
        document.body.appendChild(notification);
        return notification;
    }

    // 创建设置面板
    function createSettingsPanel() {
        if (document.getElementById('geoFS-settings-panel')) return;
        
        const panel = document.createElement('div');
        panel.id = 'geoFS-settings-panel';
        
        panel.innerHTML = `
            <h1>GeoFS卫星地图设置</h1>
            <h2>由bilibili開飛機のzm制作</h2>
            
            <div class="geoFS-setting-row">
                <label for="geoFS-map-source">地图源</label>
                <select id="geoFS-map-source">
                    ${Object.entries(MAP_SOURCES).map(([key, source]) => 
                        `<option value="${key}" ${config.mapSource === key ? 'selected' : ''}>${source.name}</option>`
                    ).join('')}
                </select>
            </div>
            
            <div class="geoFS-setting-row">
                <label for="geoFS-update-interval">
                    更新频率 <span class="geoFS-unit">(毫秒)</span>
                </label>
                <input type="number" id="geoFS-update-interval" 
                       value="${config.updateInterval}" min="500" step="500">
            </div>
            
            <div class="geoFS-setting-row">
                <label for="geoFS-radius">
                    加载半径 <span class="geoFS-unit">(米)</span>
                </label>
                <input type="number" id="geoFS-radius" 
                       value="${config.focusRadius}" min="1000" step="500">
            </div>
            
            <div class="geoFS-setting-row">
                <label for="geoFS-camera-radius">
                    相机半径 <span class="geoFS-unit">(米)</span>
                </label>
                <input type="number" id="geoFS-camera-radius" 
                       value="${config.cameraRadius}" min="1000" step="500">
            </div>
            
            <div class="geoFS-buttons">
                <button id="geoFS-save-btn">保存设置</button>
                <button id="geoFS-clear-cache-btn">清理缓存</button>
                <button id="geoFS-close-btn">关闭</button>
            </div>
        `;
        
        document.body.appendChild(panel);
        createNotification();
        
        // 保存按钮事件
        panel.querySelector('#geoFS-save-btn').addEventListener('click', saveSettings);
        
        // 清理缓存按钮事件
        panel.querySelector('#geoFS-clear-cache-btn').addEventListener('click', clearCache);
        
        // 关闭按钮事件
        panel.querySelector('#geoFS-close-btn').addEventListener('click', function() {
            isPanelVisible = false;
            updatePanelVisibility();
        });
        
        // 鼠标滚轮滚动
        panel.addEventListener('wheel', function(e) {
            e.stopPropagation();
        }, { passive: false });
        
        updatePanelVisibility();
    }

    // 更新面板可见性
    function updatePanelVisibility() {
        const panel = document.getElementById('geoFS-settings-panel');
        if (panel) {
            panel.style.display = isPanelVisible ? 'block' : 'none';
        }
    }

    // 保存设置
    function saveSettings() {
        const panel = document.getElementById('geoFS-settings-panel');
        if (!panel) return;
        
        // 获取新配置
        const newConfig = {
            mapSource: panel.querySelector('#geoFS-map-source').value,
            updateInterval: parseInt(panel.querySelector('#geoFS-update-interval').value) || DEFAULT_CONFIG.updateInterval,
            focusRadius: parseInt(panel.querySelector('#geoFS-radius').value) || DEFAULT_CONFIG.focusRadius,
            cameraRadius: parseInt(panel.querySelector('#geoFS-camera-radius').value) || DEFAULT_CONFIG.cameraRadius,
            showPanel: isPanelVisible
        };
        
        // 保存配置
        config = newConfig;
        if (saveConfig(config)) {
            showNotification('设置已保存！');
            
            // 重新初始化地图和跟踪
            applyMapSource();
            restartTracking();
            
            // 关闭面板
            isPanelVisible = false;
            updatePanelVisibility();
        } else {
            showNotification('保存设置失败！', 5000);
        }
    }

    // 清理缓存
    function clearCache() {
        try {
            // 清理本地存储的缓存数据
            localStorage.removeItem(CONFIG_STORAGE_KEY);
            // 可以根据需要清理其他缓存数据
            showNotification('缓存已清理！');
        } catch (e) {
            console.error('清理缓存出错:', e);
            showNotification('清理缓存失败！', 5000);
        }
    }

    // 应用地图源
    function applyMapSource() {
        if (!window.geofs || !window.geofs.api || !window.Cesium) {
            console.warn('GeoFS API或Cesium未加载，等待重试...');
            setTimeout(applyMapSource, 1000);
            return;
        }
        
        try {
            const provider = MAP_SOURCES[config.mapSource].provider();
            window.geofs.api.setImageryProvider(provider, false);
            
            // 保持原始地形
            window.geofs.api.viewer.terrainProvider = 
                new window.geofs.api.FlatRunwayTerrainProvider({
                    baseProvider: new Cesium.CesiumTerrainProvider({
                        url: "https://data.geo-fs.com/srtm/",
                        requestWaterMask: false,
                        requestVertexNormals: true
                    }),
                    maximumLevel: 12
                });
                
            showNotification(`已切换到${MAP_SOURCES[config.mapSource].name}`);
        } catch (e) {
            console.error('应用地图源出错:', e);
            showNotification('切换地图源失败！', 5000);
        }
    }

    // 更新地图视图范围
    function updateViewExtent() {
        if (!aircraftPosition || !window.geofs || !window.geofs.api || !window.Cesium) return;
        
        try {
            const viewer = window.geofs.api.viewer;
            
            // 设置相机约束
            viewer.scene.screenSpaceCameraController.enableCollisionDetection = true;
            viewer.scene.screenSpaceCameraController.minimumZoomDistance = 100;
            viewer.scene.screenSpaceCameraController.maximumZoomDistance = config.cameraRadius * 1.5;
            
            // 设置地图加载参数
            viewer.scene.globe.tileCacheSize = 20;
            viewer.scene.globe.maximumScreenSpaceError = 2;
            
            // 计算并设置加载范围
            const rectangle = Cesium.Rectangle.fromCartesianArray([
                Cesium.Cartesian3.add(aircraftPosition, new Cesium.Cartesian3(-config.focusRadius, -config.focusRadius, 0), new Cesium.Cartesian3()),
                Cesium.Cartesian3.add(aircraftPosition, new Cesium.Cartesian3(config.focusRadius, config.focusRadius, 0), new Cesium.Cartesian3())
            ]);
        } catch (e) {
            console.error("更新视图范围出错:", e);
        }
    }

    // 获取飞机位置
    function trackAircraftPosition() {
        try {
            const aircraft = window.geofs.aircraft.instance;
            if (aircraft && aircraft.object3d) {
                const position = aircraft.object3d.position.clone();
                aircraftPosition = new Cesium.Cartesian3(position.x, position.y, position.z);
                updateViewExtent();
            }
        } catch (e) {
            console.error("获取飞机位置出错:", e);
        }
    }

    // 重新开始跟踪
    function restartTracking() {
        if (updateTimer) {
            clearInterval(updateTimer);
        }
        trackAircraftPosition();
        updateTimer = setInterval(trackAircraftPosition, config.updateInterval);
    }

    // 初始化键盘事件
    function initKeyEvents() {
        document.addEventListener('keydown', function(e) {
            // 按D键切换面板
            if (e.key.toLowerCase() === 'd' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                isPanelVisible = !isPanelVisible;
                updatePanelVisibility();
                e.preventDefault();
            }
        });
    }

    // 主初始化函数
    function mainInit() {
        if (isInitialized) return;
        
        if (!window.geofs || !window.geofs.api) {
            setTimeout(mainInit, 500);
            return;
        }
        
        addStyles();
        createSettingsPanel();
        applyMapSource();
        initKeyEvents();
        restartTracking();
        
        isInitialized = true;
        console.log('GeoFS卫星地图插件初始化完成');
    }

    // 启动脚本
    if (document.readyState === 'complete') {
        mainInit();
    } else {
        window.addEventListener('load', mainInit);
        document.addEventListener('DOMContentLoaded', mainInit);
    }
})();
