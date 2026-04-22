import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class SimpleZoomPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage();
        window.add(page);

        const group = new Adw.PreferencesGroup({
            title: _('Zoom Behavior'),
            description: _('Hold Ctrl and scroll to zoom in/out. Respects natural scrolling.'),
        });
        page.add(group);

        // Zoom Step Setting (SpinRow)
        const zoomStepRow = new Adw.SpinRow({
            title: _('Zoom Step (Sensitivity)'),
            subtitle: _('How much each scroll wheel tick changes the zoom level'),
            adjustment: new Gtk.Adjustment({
                value: settings.get_double('zoom-step'),
                lower: 0.01,
                upper: 1.0,
                step_increment: 0.05,
                page_increment: 0.1,
            }),
            digits: 2,
        });
        group.add(zoomStepRow);

        settings.bind(
            'zoom-step',
            zoomStepRow,
            'value',
            Gio.SettingsBindFlags.DEFAULT
        );

        // Smooth Zoom Toggle (SwitchRow)
        const smoothZoomRow = new Adw.SwitchRow({
            title: _('Smooth Zoom'),
            subtitle: _('Enable animation for smoother transitions (may cause lag on slow hardware)'),
        });
        group.add(smoothZoomRow);

        settings.bind(
            'smooth-zoom',
            smoothZoomRow,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
    }
}
