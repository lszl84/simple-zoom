import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GDesktopEnums from 'gi://GDesktopEnums';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

export default class SimpleZoomExtension extends Extension {
    enable() {
        console.log("[Simple Zoom] Enabling extension");

        this._settings = this.getSettings();
        
        // Read natural scroll setting from GNOME
        this._mouseSettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.peripherals.mouse' });
        this._naturalScroll = this._mouseSettings.get_boolean('natural-scroll');
        this._mouseSettingsChangedId = this._mouseSettings.connect('changed::natural-scroll', () => {
            this._naturalScroll = this._mouseSettings.get_boolean('natural-scroll');
        });

        // Cache settings for performance
        this._updateSettings();
        this._settingsChangedId = this._settings.connect('changed', this._updateSettings.bind(this));

        // Internal State
        this._currentZoom = 1.0;
        
        // Capture Events
        this._stageSignalId = global.stage.connect('captured-event', this._onCapturedEvent.bind(this));
    }

    _updateSettings() {
        this._zoomStep = this._settings.get_double('zoom-step');
        this._smoothZoom = this._settings.get_boolean('smooth-zoom');
    }

    disable() {
        console.log("[Simple Zoom] Disabling extension...");

        if (this._stageSignalId) {
            global.stage.disconnect(this._stageSignalId);
            this._stageSignalId = null;
        }

        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = null;
        }

        if (this._mouseSettingsChangedId) {
            this._mouseSettings.disconnect(this._mouseSettingsChangedId);
            this._mouseSettingsChangedId = null;
        }
        this._mouseSettings = null;

        if (this._currentZoom > 1.0) {
            this._applyZoom(1.0);
        }
        
        this._settings = null;
    }

    _onCapturedEvent(actor, event) {
        // Only interested in SCROLL events
        if (event.type() !== Clutter.EventType.SCROLL) {
            return Clutter.EVENT_PROPAGATE;
        }

        const state = event.get_state();
        const hasCtrl = (state & Clutter.ModifierType.CONTROL_MASK) !== 0;

        // Simple: just Ctrl, nothing else
        if (!hasCtrl) {
            return Clutter.EVENT_PROPAGATE;
        }

        // Zoom Logic
        const direction = event.get_scroll_direction();
        let zoomChange = 0;
        const ZOOM_STEP = this._zoomStep || 0.25;

        if (direction === Clutter.ScrollDirection.SMOOTH) {
            const [dx, dy] = event.get_scroll_delta();
            // Respect natural scrolling: if natural scroll is ON, invert the delta
            const effectiveDy = this._naturalScroll ? -dy : dy;
            zoomChange = -effectiveDy * ZOOM_STEP; 
        } else {
            // Respect natural scrolling for discrete events too
            const scrollUp = this._naturalScroll ? Clutter.ScrollDirection.DOWN : Clutter.ScrollDirection.UP;
            const scrollDown = this._naturalScroll ? Clutter.ScrollDirection.UP : Clutter.ScrollDirection.DOWN;
            
            if (direction === scrollUp) {
                zoomChange = ZOOM_STEP;
            } else if (direction === scrollDown) {
                zoomChange = -ZOOM_STEP;
            }
        }

        if (Math.abs(zoomChange) < 0.001) return Clutter.EVENT_STOP;

        let newZoom = this._currentZoom + zoomChange;

        // Safety limits (1.0x to 20.0x)
        if (newZoom < 1.0) newZoom = 1.0;
        if (newZoom > 20.0) newZoom = 20.0;

        if (newZoom !== this._currentZoom) {
            this._applyZoom(newZoom);
        }

        return Clutter.EVENT_STOP;
    }

    _applyZoom(zoomFactor) {
        this._currentZoom = zoomFactor;

        if (!Main.magnifier) {
            console.error("[Simple Zoom] Main.magnifier not found");
            return;
        }

        // Activation/Deactivation
        if (this._currentZoom > 1.0) {
            if (!Main.magnifier.isActive()) {
                Main.magnifier.setActive(true);
            }
        } else {
            if (Main.magnifier.isActive()) {
                Main.magnifier.setActive(false);
            }
        }

        // Apply zoom factor to all regions
        let regions = Main.magnifier.getZoomRegions();
        if (regions.length === 0 && this._currentZoom > 1.0) {
            const [width, height] = global.display.get_size();
            const roi = { x: 0, y: 0, width, height };
            const viewPort = { x: 0, y: 0, width, height };
            const newRegion = Main.magnifier.createZoomRegion(zoomFactor, zoomFactor, roi, viewPort);
            Main.magnifier.addZoomRegion(newRegion);
            regions = [newRegion];
        }

        regions.forEach(region => {
            region._changeROI({
                xMagFactor: zoomFactor,
                yMagFactor: zoomFactor,
                redoCursorTracking: true,
                animate: this._smoothZoom,
            });
            
            if (region.getMouseTrackingMode() !== GDesktopEnums.MagnifierMouseTrackingMode.PROPORTIONAL) {
                region.setMouseTrackingMode(GDesktopEnums.MagnifierMouseTrackingMode.PROPORTIONAL);
            }
        });
    }
}
