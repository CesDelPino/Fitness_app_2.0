import { AdminLayout } from "@/components/admin-v2/AdminLayout";
import { Route, Switch as RouterSwitch, Redirect } from "wouter";
import { EquipmentTab } from "@/components/admin-v2/catalog/EquipmentTab";
import { GoalsTab } from "@/components/admin-v2/catalog/GoalsTab";
import { ExercisesTab } from "@/components/admin-v2/catalog/ExercisesTab";
import { RoutinesTab } from "@/components/admin-v2/catalog/RoutinesTab";
import { PresetsTab } from "@/components/admin-v2/catalog/PresetsTab";
import { FoodsTab } from "@/components/admin-v2/catalog/FoodsTab";

export default function AdminCatalogPage() {
  return (
    <AdminLayout>
      <RouterSwitch>
        <Route path="/admin/catalog/equipment" component={EquipmentTab} />
        <Route path="/admin/catalog/goals" component={GoalsTab} />
        <Route path="/admin/catalog/exercises" component={ExercisesTab} />
        <Route path="/admin/catalog/routines" component={RoutinesTab} />
        <Route path="/admin/catalog/presets" component={PresetsTab} />
        <Route path="/admin/catalog/foods" component={FoodsTab} />
        <Route path="/admin/catalog">
          <Redirect to="/admin/catalog/equipment" />
        </Route>
      </RouterSwitch>
    </AdminLayout>
  );
}
