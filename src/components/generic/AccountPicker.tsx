import {
  ContactDoc,
  AccountDoc,
  useCurrentAccount,
  useSelf,
  automergeUrlToAccountToken,
  accountTokenToAutomergeUrl,
} from "../../account";
import { ChangeEvent, useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTrigger,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useDocument } from "@automerge/automerge-repo-react-hooks";

import { Copy, Eye, EyeOff } from "lucide-react";

import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ContactAvatar } from "./ContactAvatar";

// 1MB in bytes
const MAX_AVATAR_SIZE = 1024 * 1024;

enum AccountPickerTab {
  LogIn = "logIn",
  SignUp = "signUp",
}

type AccountTokenToLoginStatus = null | "valid" | "malformed" | "not-found";

export const AccountPicker = () => {
  const currentAccount = useCurrentAccount();

  const self = useSelf();
  const [name, setName] = useState<string>("");
  const [avatar, setAvatar] = useState<File>();
  const [activeTab, setActiveTab] = useState<AccountPickerTab>(
    AccountPickerTab.SignUp
  );
  const [showAccountKeys, setShowAccountKeys] = useState(false);
  const [isCopyTooltipOpen, setIsCopyTooltipOpen] = useState(false);

  const [accountFileStringToLogin, setAccountFileStringToLogin] =
    useState<string>("");
  const accountFileToLogin = (() => {
    let accountFile;
    try {
      accountFile = JSON.parse(accountFileStringToLogin);
    } catch (err) {
      console.warn("invalid account file");
    }

    return accountFile;
  })();

  const [accountToLogin] = useDocument<AccountDoc>(
    accountFileToLogin?.accountUrl
  );
  const [contactToLogin] = useDocument<ContactDoc>(accountToLogin?.contactUrl);

  const accountFileToLoginStatus: AccountTokenToLoginStatus = "valid";
  // todo: adjust validation for account file
  /*(() => {
        if (!accountTokenToLogin || accountTokenToLogin === "") return null;
    if (!accountAutomergeUrlToLogin) return "malformed";
    if (!accountToLogin) return "not-found"; 
    if (!contactToLogin) return "not-found"; 
    return "valid";
  })(); */

  const currentAccountFile = currentAccount ? currentAccount.serialize() : null;

  // initialize form values if already logged in
  useEffect(() => {
    if (self && self.type === "registered" && name === "") {
      setName(self.name);
    }
  }, [self]);

  const onSubmit = () => {
    switch (activeTab) {
      case AccountPickerTab.LogIn:
        currentAccount.logIn(accountFileToLogin);
        break;

      case AccountPickerTab.SignUp:
        currentAccount.signUp({ name, avatar });
        break;
    }
  };

  const onLogout = () => {
    currentAccount.logOut();
  };

  const onFilesChanged = (e: ChangeEvent<HTMLInputElement>) => {
    const avatarFile = !e.target.files ? undefined : e.target.files[0];
    if (avatarFile.size > MAX_AVATAR_SIZE) {
      alert("Avatar is too large. Please choose a file under 1MB.");
      e.target.value = "";
      return;
    }
    setAvatar(avatarFile);
  };

  const onToggleShowAccountUrl = () => {
    setShowAccountKeys((showAccountUrl) => !showAccountUrl);
  };

  const onCopy = () => {
    navigator.clipboard.writeText(currentAccountFile);

    setIsCopyTooltipOpen(true);

    setTimeout(() => {
      setIsCopyTooltipOpen(false);
    }, 1000);
  };

  const isSubmittable =
    (activeTab === AccountPickerTab.SignUp && name) ||
    (activeTab === AccountPickerTab.LogIn &&
      accountFileStringToLogin &&
      accountToLogin?.contactUrl &&
      contactToLogin?.type === "registered");

  const isLoggedIn = self?.type === "registered";

  return (
    <Dialog>
      <DialogTrigger>
        <ContactAvatar url={currentAccount?.contactHandle.url} />
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader className="items-center">
          {isLoggedIn ? (
            <ContactAvatar
              size="lg"
              url={currentAccount?.contactHandle.url}
              name={name}
              avatar={avatar}
            ></ContactAvatar>
          ) : activeTab === "signUp" ? (
            <ContactAvatar name={name} avatar={avatar} size={"lg"} />
          ) : (
            <ContactAvatar
              url={accountToLogin?.contactUrl}
              size="lg"
            ></ContactAvatar>
          )}
        </DialogHeader>

        {!isLoggedIn && (
          <Tabs
            defaultValue={AccountPickerTab.SignUp}
            className="w-full"
            onValueChange={(tab) => setActiveTab(tab as AccountPickerTab)}
            value={activeTab}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value={AccountPickerTab.SignUp}>Sign up</TabsTrigger>
              <TabsTrigger value={AccountPickerTab.LogIn}>Log in</TabsTrigger>
            </TabsList>
            <TabsContent value={AccountPickerTab.SignUp}>
              <div className="grid w-full max-w-sm items-center gap-1.5 py-4">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(evt) => setName(evt.target.value)}
                />
              </div>

              <div className="grid w-full max-w-sm items-center gap-1.5">
                <Label htmlFor="picture">Avatar</Label>
                <Input
                  id="avatar"
                  type="file"
                  accept="image/*"
                  onChange={onFilesChanged}
                />
              </div>
            </TabsContent>
            <TabsContent value={AccountPickerTab.LogIn}>
              <form className="grid w-full max-w-sm items-center gap-1.5 py-4">
                <Label htmlFor="accountUrl">Account file</Label>

                <div className="flex gap-1.5">
                  <Input
                    className={`${
                      accountFileToLoginStatus === "valid" ? "bg-green-100" : ""
                    }`}
                    id="accountUrl"
                    value={accountFileStringToLogin}
                    onChange={(evt) => {
                      setAccountFileStringToLogin(evt.target.value);
                    }}
                    type={showAccountKeys ? "text" : "password"}
                    autoComplete="current-password"
                  />
                  <Button variant="ghost" onClick={onToggleShowAccountUrl}>
                    {showAccountKeys ? <Eye /> : <EyeOff />}
                  </Button>
                </div>

                <div className="h-8 text-sm text-red-500">
                  {accountFileToLoginStatus === "malformed" && (
                    <div>
                      Not a valid account token, try copy-pasting again.
                    </div>
                  )}
                  {accountFileToLoginStatus === "not-found" && (
                    <div>Account not found</div>
                  )}
                </div>

                <p className="text-gray-500 text-justify pb-2 text-sm">
                  To login, paste your account file.
                </p>
                <p className="text-gray-500 text-justify pb-2 text-sm mb-2">
                  You can find your account file by accessing the account dialog
                  on any device where you are currently logged in.
                </p>
              </form>
            </TabsContent>
          </Tabs>
        )}

        {isLoggedIn && (
          <>
            <div className="grid w-full max-w-sm items-center gap-1.5 py-4">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(evt) => setName(evt.target.value)}
              />
            </div>

            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="picture">Avatar</Label>
              <Input
                id="avatar"
                type="file"
                accept="image/*"
                onChange={onFilesChanged}
              />
            </div>

            <form className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="picture">Account file</Label>

              <div className="flex gap-1.5">
                <Input
                  onFocus={(e) => e.target.select()}
                  value={currentAccountFile}
                  id="accountUrl"
                  type={showAccountKeys ? "text" : "password"}
                  accept="image/*"
                  onChange={onFilesChanged}
                  autoComplete="off"
                />

                <Button variant="ghost" onClick={onToggleShowAccountUrl}>
                  {showAccountKeys ? <Eye /> : <EyeOff />}
                </Button>

                <TooltipProvider>
                  <Tooltip open={isCopyTooltipOpen}>
                    <TooltipTrigger
                      onClick={onCopy}
                      onBlur={() => setIsCopyTooltipOpen(false)}
                    >
                      <Copy />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Copied</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <p className="text-gray-500 text-justify pt-2 text-sm">
                To log in on another device, copy your account file and paste it
                into the login screen on the other device.
              </p>
              <p className="text-gray-500 text-justify pt-2 text-sm">
                ⚠️ WARNING: this app has limited security, don't use it for
                private docs.
              </p>
            </form>
          </>
        )}
        <DialogFooter className="gap-1.5">
          {isLoggedIn && (
            <DialogTrigger asChild>
              <Button onClick={onLogout} variant="secondary">
                Sign out
              </Button>
            </DialogTrigger>
          )}
          <DialogTrigger asChild>
            <Button type="submit" onClick={onSubmit} disabled={!isSubmittable}>
              {isLoggedIn
                ? "Save"
                : activeTab === "signUp"
                ? "Sign up"
                : `Log in${
                    contactToLogin && contactToLogin.type === "registered"
                      ? ` as ${contactToLogin.name}`
                      : ""
                  }`}
            </Button>
          </DialogTrigger>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
