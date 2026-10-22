import { UserButton } from "@clerk/nextjs"

import {
  Sidebar,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarFooter className="mt-auto">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<div />}
              className="p-0 has-focus-visible:ring-2"
            >
              <UserButton
                showName
                appearance={{
                  elements: {
                    rootBox: "h-full w-full",
                    userButtonTrigger:
                      "h-full w-full rounded-md p-2 text-inherit shadow-none transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:shadow-none active:bg-sidebar-accent active:text-sidebar-accent-foreground",
                    userButtonBox:
                      "w-full min-w-0 flex-row-reverse justify-end gap-2",
                    userButtonAvatarBox: "size-6 shrink-0",
                    userButtonOuterIdentifier:
                      "min-w-0 flex-1 truncate p-0 text-left text-sm font-normal text-inherit",
                  },
                }}
              />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
